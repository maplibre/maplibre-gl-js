/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const zlib = require('zlib');
const maplibreGLJSSrc = fs.readFileSync('dist/maplibre-gl.js', 'utf8');
const maplibreGLCSSSrc = fs.readFileSync('dist/maplibre-gl.css', 'utf8');
const benchSrc = fs.readFileSync('bench/gl-stats.html', 'utf8');
const {execSync} = require('child_process');

const benchHTML = benchSrc
    .replace(/<script src="..\/dist\/maplibre-gl.js"><\/script>/, `<script>${maplibreGLJSSrc}</script>`)

function waitForConsole(page) {
    return new Promise((resolve) => {
        function onConsole(msg) {
            page.removeListener('console', onConsole);
            resolve(msg.text());
        }
        page.on('console', onConsole);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log('collecting stats...');
    await page.setViewport({width: 600, height: 600, deviceScaleFactor: 2});
    await page.setContent(benchHTML);

    const stats = JSON.parse(await waitForConsole(page));
    stats["bundle_size"] = maplibreGLJSSrc.length + maplibreGLCSSSrc.length;
    stats["bundle_size_gz"] = zlib.gzipSync(maplibreGLJSSrc).length + zlib.gzipSync(maplibreGLCSSSrc).length;
    stats.dt = execSync('git show --no-patch --no-notes --pretty=\'%cI\' HEAD').toString().substring(0, 19);
    stats.commit = execSync('git rev-parse --short HEAD').toString().trim();
    stats.message = execSync('git show -s --format=%s HEAD').toString().trim();
    console.log(JSON.stringify(stats, null, 2));

    fs.writeFileSync('data.json.gz', zlib.gzipSync(JSON.stringify(stats)));

    await page.close();
    await browser.close();
})();
