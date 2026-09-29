import puppeteer, {type Browser, type Page, type WebWorker} from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import {CoverageReport} from 'monocart-coverage-reports';

export async function launchPuppeteer(headless = true): Promise<Browser> {
    return puppeteer.launch({
        headless,
        args: [
            '--disable-gpu',
            '--enable-features=AllowSwiftShaderFallback,AllowSoftwareGLFallbackDueToCrashes',
            '--enable-unsafe-swiftshader'
        ],
    });
}

/** Start JS coverage on the page and on every worker it spawns. */
export async function startCoverage(page: Page): Promise<WebWorker[]> {
    const workers: WebWorker[] = [];
    page.on('workercreated', async (worker: WebWorker) => {
        workers.push(worker);
        try {
            await worker.client.send('Profiler.enable');
            await worker.client.send('Profiler.startPreciseCoverage', {callCount: true, detailed: true});
        } catch {}
    });
    await page.coverage.startJSCoverage({includeRawScriptCoverage: true});
    return workers;
}

/** Harvest page + worker coverage, close the page(s), and write a monocart report to `coverage/<outputDir>`. */
export async function stopCoverageAndReport(pageOrPages: Page | Page[], workers: WebWorker[], outputDir: string): Promise<void> {
    const pages = Array.isArray(pageOrPages) ? pageOrPages : [pageOrPages];
    const coverage = (await Promise.all(pages.map((page) => page.coverage.stopJSCoverage()))).flat();

    const workerCoverageEntries: any[] = [];
    for (const worker of workers) {
        try {
            const result = await worker.client.send('Profiler.takePreciseCoverage');
            workerCoverageEntries.push(...result.result);
        } catch {}
    }

    await Promise.all(pages.map((page) => page.close()));

    /** The bundles a script URL can belong to. `maplibre-gl-shared-dev.mjs` holds most of the source,
     * and both the page and the worker load it, so coverage of it is reported from either side. */
    const bundles = ['maplibre-gl-dev.mjs', 'maplibre-gl-worker-dev.mjs', 'maplibre-gl-shared-dev.mjs'];
    const sourceMaps = new Map<string, any>(bundles.map((bundle) =>
        [bundle, JSON.parse(fs.readFileSync(`dist/${bundle}.map`, 'utf-8'))]));

    const rawV8CoverageData: any[] = coverage.map((it) => {
        const entry: any = {source: it.text, ...it.rawScriptCoverage};
        entry.sourceMap = sourceMaps.get(bundles.find((name) => entry.url.endsWith(name)));
        return entry;
    });

    for (const entry of workerCoverageEntries) {
        const bundle = bundles.find((name) => entry.url.endsWith(name));
        if (bundle) {
            rawV8CoverageData.push({
                source: fs.readFileSync(`dist/${bundle}`, 'utf-8'),
                url: entry.url,
                scriptId: entry.scriptId,
                functions: entry.functions,
                sourceMap: sourceMaps.get(bundle)
            });
        }
    }

    const coverageReport = new CoverageReport({
        name: 'MapLibre Coverage Report',
        outputDir: `./coverage/${outputDir}`,
        reports: [['v8'], ['json']],
        sourcePath: (relativePath) => path.resolve(relativePath)
    });
    coverageReport.cleanCache();
    await coverageReport.add(rawV8CoverageData);
    await coverageReport.generate();
}
