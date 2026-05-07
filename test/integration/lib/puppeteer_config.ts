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

/** Harvest page + worker coverage, close the page, and write a monocart report to `coverage/<outputDir>`. */
export async function stopCoverageAndReport(page: Page, workers: WebWorker[], outputDir: string): Promise<void> {
    const coverage = await page.coverage.stopJSCoverage();

    const workerCoverageEntries: any[] = [];
    for (const worker of workers) {
        try {
            const result = await worker.client.send('Profiler.takePreciseCoverage');
            workerCoverageEntries.push(...result.result);
        } catch {}
    }

    await page.close();

    const rawV8CoverageData: any[] = coverage.map((it) => {
        const entry: any = {source: it.text, ...it.rawScriptCoverage};
        if (entry.url.endsWith('maplibre-gl-dev.mjs')) {
            entry.sourceMap = JSON.parse(fs.readFileSync('dist/maplibre-gl-dev.mjs.map', 'utf-8'));
        }
        return entry;
    });

    const workerSource = fs.readFileSync('dist/maplibre-gl-worker-dev.mjs', 'utf-8');
    const workerSourceMap = JSON.parse(fs.readFileSync('dist/maplibre-gl-worker-dev.mjs.map', 'utf-8'));
    for (const entry of workerCoverageEntries) {
        if (entry.url.endsWith('maplibre-gl-worker-dev.mjs')) {
            rawV8CoverageData.push({
                source: workerSource,
                url: entry.url,
                scriptId: entry.scriptId,
                functions: entry.functions,
                sourceMap: workerSourceMap
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
