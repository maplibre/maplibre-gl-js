import puppeteer from 'puppeteer';

const url = 'http://localhost:9966/test/bench/versions/index.html?compare=#Terrain3DGlobe';
const browser = await puppeteer.launch({headless: true});
try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(0);
    await page.evaluateOnNewDocument(() => { globalThis.__perf = {counters: {}}; });
    await page.setViewport({width: 1280, height: 1024});
    await page.goto(url);
    await page.waitForFunction('window.maplibreglBenchmarkFinished === true', {timeout: 0});
    const result = await page.evaluate(() => ({
        counters: /** @type {any} */ (globalThis).__perf?.counters || {},
        results: /** @type {any} */ (window).maplibreglBenchmarkResults
    }));
    console.log(JSON.stringify(result, null, 2));
} finally {
    await browser.close();
}
