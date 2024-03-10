import puppeteer, {Page} from 'puppeteer';
import fs from 'fs';
import zlib from 'zlib';
import {execSync} from 'child_process';

const maplibreGLJSSrc = fs.readFileSync('dist/maplibre-gl.js');
const maplibreGLCSSSrc = fs.readFileSync('dist/maplibre-gl.css');
const benchSrc = fs.readFileSync('test/bench/gl-stats.html', 'utf8');

const benchHTML = benchSrc
    .replace('<script src="/dist\/maplibre-gl.js"></script>', `<script src="data:text/javascript;base64,${maplibreGLJSSrc.toString('base64')}"></script>`);

function waitForConsole(page: Page): Promise<string> {
    return new Promise((resolve) => {
        function onConsole(msg) {
            page.off('console', onConsole);
            resolve(msg.text());
        }
        page.on('console', onConsole);
    });
}

const browser = await puppeteer.launch({headless: true});
try {

    const page = await browser.newPage();
    await page.setViewport({width: 600, height: 600, deviceScaleFactor: 2});

    console.log('collecting stats...');
    await page.setContent(benchHTML);

    const stats = JSON.parse(await waitForConsole(page));
    stats['bundle_size'] = maplibreGLJSSrc.length + maplibreGLCSSSrc.length;
    stats['bundle_size_gz'] = zlib.gzipSync(maplibreGLJSSrc).length + zlib.gzipSync(maplibreGLCSSSrc).length;
    stats.dt = execSync('git show --no-patch --no-notes --pretty=\'%cI\' HEAD').toString().substring(0, 19);
    stats.commit = execSync('git rev-parse --short HEAD').toString().trim();
    stats.message = execSync('git show -s --format=%s HEAD').toString().trim();
    console.log(JSON.stringify(stats, null, 2));

    fs.writeFileSync('data.json.gz', zlib.gzipSync(JSON.stringify(stats)));

    await page.close();
} finally {
    await browser.close();
}
