import http from 'node:http';
import st from 'st';
import minimist from 'minimist';
import {launchPuppeteer} from '../../integration/lib/puppeteer_config.ts';
import {summaryStatistics} from '../lib/statistics.ts';
import type {Page} from 'puppeteer';
import type * as MapLibreGL from '../../../dist/maplibre-gl';

const PORT = 2900;
const METRICS = ['bundleImport', 'styleLoad', 'firstTile', 'mapLoad', 'mapIdle',
    'flightNoPreload', 'flightPreload', 'blankNoPreload', 'blankPreload'];

/**
 * A network style, because the local fixtures cover six scattered tiles and a flight would land
 * where nothing loads. These two metrics are therefore the only ones here that touch the network,
 * and they are skipped rather than failed when it is unavailable.
 */
const FLIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const FLIGHT_ORIGIN = {center: [-73.9857, 40.7484] as [number, number], zoom: 4};

/**
 * Two destinations rather than one flown to twice: a flight warms the tiles at where it lands, so
 * measuring the second flight to the same place would credit it with the first one's downloads.
 */
const FLIGHT_DESTINATIONS: Record<'flightNoPreload' | 'flightPreload', {center: [number, number]; zoom: number}> = {
    flightNoPreload: {center: [139.6917, 35.6895], zoom: 11},
    flightPreload: {center: [12.4964, 41.9028], zoom: 11}
};

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

const flightConfig = {
    style: FLIGHT_STYLE,
    origin: FLIGHT_ORIGIN,
    destinations: FLIGHT_DESTINATIONS
};

function measureInPage(page: Page, bundleUrl: string, preloadFirst: boolean): Promise<{version: string; metrics: Record<string, number>}> {
    return page.evaluate(async (bundleUrl, flight, preloadFirst) => {
        performance.mark('bundle-import-start');
        const maplibregl: typeof MapLibreGL = await import(bundleUrl);
        performance.mark('bundle-import-end');

        const styleResponse = await fetch(`${location.origin}/styles/basic-v9.json`);
        const styleText = await styleResponse.text();
        const style = JSON.parse(styleText.replaceAll('local://', `${location.origin}/`));

        /**
         * Flies to a destination across the world and reports how long the map takes to settle there,
         * once with the movement loading its tiles on the way and once without.
         *
         * A release that predates the option ignores `preload`, so a release supplies the "before"
         * number and the working copy supplies "before and after". Returns nothing when the style
         * cannot be loaded, which leaves those rows blank rather than failing the run.
         */
        const measureFlights = async () => {
            const container = document.createElement('div');
            container.style.cssText = 'position:absolute;left:-99999px;width:1280px;height:1024px';
            document.body.appendChild(container);

            const flightMap = new maplibregl.Map({container, style: flight.style, ...flight.origin});
            try {
                await flightMap.once('idle');
            } catch {
                return {}; // No network, or the style never settled. The load metrics are local.
            }

            // Whichever variant flies first gets the cold connection, so the order alternates between
            // runs: always going second would hand the preload a warmed connection and credit it with
            // a win it did not earn.
            const order = preloadFirst
                ? ['flightPreload', 'flightNoPreload']
                : ['flightNoPreload', 'flightPreload'];

            const flightMetrics: Record<string, number> = {};
            for (const metric of order) {
                const destination = flight.destinations[metric];
                flightMap.jumpTo(flight.origin);
                await flightMap.once('idle');

                performance.mark('flight-start');
                const arrived = new Promise<void>((resolve) => flightMap.once('moveend', () => {
                    performance.mark('flight-arrived');
                    resolve();
                }));
                flightMap.flyTo({...destination, preload: metric === 'flightPreload'});

                // How long the destination stays unfinished once the camera is on it. This is the part
                // a preload can remove, and it is steadier than the total: the flight itself takes the
                // same time either way, whereas this is zero when the tiles got there first.
                await arrived;
                await flightMap.once('idle');
                performance.mark('flight-end');

                performance.measure(metric, 'flight-start', 'flight-end');
                performance.measure(`blank${metric === 'flightPreload' ? 'Preload' : 'NoPreload'}`, 'flight-arrived', 'flight-end');
                flightMetrics[metric] = performance.getEntriesByName(metric, 'measure')[0].duration;
            }
            for (const name of ['blankNoPreload', 'blankPreload']) {
                const entry = performance.getEntriesByName(name, 'measure')[0];
                if (entry) flightMetrics[name] = entry.duration;
            }

            flightMap.remove();
            container.remove();
            return flightMetrics;
        };

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

        Object.assign(metrics, await measureFlights());

        return {version: maplibregl.getVersion(), metrics};
    }, bundleUrl, flightConfig, preloadFirst);
}

async function measureOnce(page: Page, artifact: Artifact, preloadFirst: boolean): Promise<{version: string; metrics: Record<string, number>}> {
    await page.goto(`http://localhost:${PORT}/e2e/index.html`, {waitUntil: 'load'});
    try {
        await page.addStyleTag({url: new URL('maplibre-gl.css', artifact.url).href});
        return await Promise.race([
            measureInPage(page, artifact.url, preloadFirst),
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
                const result = await measureOnce(page, artifact, i % 2 === 1);
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
