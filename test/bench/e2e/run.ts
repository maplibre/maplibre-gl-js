import http from 'node:http';
import st from 'st';
import minimist from 'minimist';
import {launchPuppeteer} from '../../integration/lib/puppeteer_config.ts';
import {summaryStatistics} from '../lib/statistics.ts';
import type {Page} from 'puppeteer';
import type * as MapLibreGL from '../../../dist/maplibre-gl';

const PORT = 2900;
const METRICS = ['bundleImport', 'styleLoad', 'firstTile', 'mapLoad', 'mapIdle'];

type Artifact = {
    url: string;
    origin: string;
    version?: string;
    samples: Record<string, number[]>;
};

function resolveArtifact(spec: string): Artifact {
    const samples = Object.fromEntries(METRICS.map(m => [m, []]));
    if (spec === 'dist') {
        return {url: `http://localhost:${PORT}/dist/maplibre-gl.mjs`, origin: 'dist', samples};
    }
    if (spec === 'latest') {
        return {url: 'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.mjs', origin: 'unpkg', samples};
    }
    if (spec.startsWith('http://') || spec.startsWith('https://')) {
        return {url: spec, origin: new URL(spec).hostname, samples};
    }
    const version = spec.replace(/^v/, '');
    return {url: `https://unpkg.com/maplibre-gl@${version}/dist/maplibre-gl.mjs`, origin: 'unpkg', samples};
}

function createServer(): Promise<http.Server> {
    const assetsMount = st({path: 'test/integration/assets', cors: true, passthrough: true});
    const distMount = st({path: 'dist', url: '/dist', cors: true, passthrough: true});
    const pageMount = st({path: 'test/bench/e2e', url: '/e2e', cors: true, passthrough: true});
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        pageMount(req, res, () => {
            distMount(req, res, () => {
                assetsMount(req, res, () => {
                    res.writeHead(404);
                    res.end('');
                });
            });
        });
    });
    return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

function measureInPage(page: Page, bundleUrl: string): Promise<{version: string; metrics: Record<string, number>}> {
    return page.evaluate(async (bundleUrl) => {
        performance.mark('bundle-import-start');
        const maplibregl: typeof MapLibreGL = await import(bundleUrl);
        performance.mark('bundle-import-end');

        const styleResponse = await fetch(`${location.origin}/styles/basic-v9.json`);
        const styleText = await styleResponse.text();
        const style = JSON.parse(styleText.replaceAll('local://', `${location.origin}/`));

        let sawFirstTile = false;
        performance.mark('map-create');
        const map = new maplibregl.Map({
            container: 'map',
            style,
            center: [0, 0],
            zoom: 0
        });
        map.on('style.load', () => performance.mark('style-load'));
        map.on('sourcedata', (e) => {
            if (e.tile && !sawFirstTile) {
                sawFirstTile = true;
                performance.mark('first-tile');
            }
        });
        map.once('load', () => performance.mark('map-load'));
        await new Promise(resolve => map.once('idle', resolve));
        performance.mark('map-idle');

        const metrics: Record<string, number> = {};
        const measureFrom = (name: string, startMark: string, endMark: string) => {
            performance.measure(name, startMark, endMark);
            metrics[name] = performance.getEntriesByName(name, 'measure')[0].duration;
        };
        measureFrom('bundleImport', 'bundle-import-start', 'bundle-import-end');
        measureFrom('styleLoad', 'map-create', 'style-load');
        if (sawFirstTile) {
            measureFrom('firstTile', 'map-create', 'first-tile');
        }
        measureFrom('mapLoad', 'map-create', 'map-load');
        measureFrom('mapIdle', 'map-create', 'map-idle');

        return {version: maplibregl.getVersion(), metrics};
    }, bundleUrl);
}

async function measureOnce(page: Page, artifact: Artifact): Promise<{version: string; metrics: Record<string, number>}> {
    await page.goto(`http://localhost:${PORT}/e2e/index.html`, {waitUntil: 'load'});
    try {
        await page.addStyleTag({url: new URL('maplibre-gl.css', artifact.url).href});
        return await Promise.race([
            measureInPage(page, artifact.url),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out after 60s')), 60_000)),
        ]);
    } catch (error) {
        throw new Error(`benchmark page failed for ${artifact.url}: ${(error as Error).message}`);
    }
}

function trimmedMean(samples: number[]): number {
    const summary = summaryStatistics(samples);
    return summary.trimmedMean ?? summary.mean;
}

function formatTable(artifacts: Artifact[]): string {
    const labels = artifacts.map(a => `${a.version} (${a.origin})`);
    const rows = METRICS
        .filter(metric => artifacts.some(a => a.samples[metric].length > 0))
        .map((metric) => {
            const means = artifacts.map(a => a.samples[metric].length > 0 ? trimmedMean(a.samples[metric]) : NaN);
            const cells = means.map(m => Number.isNaN(m) ? '-' : `${m.toFixed(1)} ms`);
            if (artifacts.length === 2 && !means.some(Number.isNaN)) {
                const delta = (means[1] - means[0]) / means[0] * 100;
                cells.push(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`);
            }
            return [metric, ...cells];
        });
    const header = ['', ...labels, ...(artifacts.length === 2 ? ['delta'] : [])];
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
    return [header, ...rows]
        .map(row => row.map((cell, i) => cell.padEnd(widths[i] + 2)).join('').trimEnd())
        .join('\n');
}

async function main() {
    const argv = minimist(process.argv.slice(2), {default: {runs: 8}});
    const artifacts = (argv._.length > 0 ? argv._ : ['latest', 'dist']).map(String).map(resolveArtifact);
    const runs = Number(argv.runs);

    const server = await createServer();
    const browser = await launchPuppeteer();
    try {
        for (const artifact of artifacts) {
            const page = await browser.newPage();
            await page.setViewport({width: 1280, height: 1024});

            for (let i = -1; i < runs; i++) {
                const result = await measureOnce(page, artifact);
                artifact.version = result.version;
                if (i >= 0) {
                    for (const metric of METRICS) {
                        if (typeof result.metrics[metric] === 'number') {
                            artifact.samples[metric].push(result.metrics[metric]);
                        }
                    }
                }
            }
            await page.close();
            console.log(`measured ${artifact.version} (${artifact.origin}): ${runs} runs`);
        }
        console.log();
        console.log(formatTable(artifacts));
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((error) => {
    console.error(`${error}`);
    process.exit(1);
});
