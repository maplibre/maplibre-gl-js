import {describe, beforeAll, afterAll, test, expect} from 'vitest';
import {type Browser, type ConsoleMessage, type Page} from 'puppeteer';
import {execSync} from 'node:child_process';
import {existsSync, readdirSync, statSync} from 'node:fs';
import http, {type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import st from 'st';

import {launchPuppeteer} from '../lib/puppeteer_config';

// Smoke-tests each bundler example under `test/integration/bundler/`:
// installs deps, builds, opens the result in headless Chrome, and verifies
// that the canvas appears and that the map goes on to request vector tiles,
// which it only does once the worker is actually running.

const POST_LOAD_WAIT_MS = 3000;
const TILE_WAIT_MS = 15000;
const TEST_TIMEOUT_MS = 300000;

// Headless-Chrome / SwiftShader quirks that aren't bundler bugs.
const ENV_NOISE = [
    /webglcontextcreationerror/i,
    /failed to initialize webgl/i,
    /swiftshader/i
];
const isEnvNoise = (text: string) => ENV_NOISE.some((re) => re.test(text));

const bundlerDir = 'test/integration/bundler';
const examples = readdirSync(bundlerDir, {withFileTypes: true})
    .filter((e) => e.isDirectory() && statSync(path.join(bundlerDir, e.name)).isDirectory())
    .map((e) => `${bundlerDir}/${e.name}`)
    .sort();

let browser: Browser;

// Build output directory, in the order examples are allowed to use:
// `dist/` for the bundlers that let you name it, `out/` for Next's static
// export, and the example directory itself when the build is in place.
const outputDirs = ['dist', 'out'];

describe('Bundler examples', () => {
    beforeAll(async () => {
        browser = await launchPuppeteer();
    }, 60000);

    afterAll(async () => {
        if (browser) await browser.close();
    });

    for (const dir of examples) {
        test(`${dir} builds and runs in a browser`, {timeout: TEST_TIMEOUT_MS}, async () => {
            execSync('npm install', {cwd: dir, stdio: 'inherit'});
            execSync('npm run build', {cwd: dir, stdio: 'inherit'});

            // Serve the example's own build output as the site root, so that
            // root-absolute URLs (`/maplibre/maplibre-gl-worker.mjs`) resolve
            // the same way they would in a real deployment.
            const root = outputDirs
                .map((name) => path.join(dir, name))
                .find((candidate) => existsSync(path.join(candidate, 'index.html'))) ?? dir;

            const server: Server = http.createServer(st(root));
            await new Promise<void>((resolve) => server.listen(resolve));
            const port = (server.address() as AddressInfo).port;

            const consoleMessages: string[] = [];
            const failedRequests: string[] = [];
            const errors: string[] = [];
            const tileRequests: string[] = [];

            const page: Page = await browser.newPage();
            try {
                page.on('request', (req) => {
                    if (/\.pbf(\?|$)/.test(req.url())) tileRequests.push(req.url());
                });
                page.on('console', (msg: ConsoleMessage) => {
                    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
                    const text = msg.text();
                    if (msg.type() === 'error' && /MIME|module|Worker/i.test(text) && !isEnvNoise(text)) {
                        errors.push(`console.error: ${text}`);
                    }
                });
                page.on('pageerror', (err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    if (!isEnvNoise(message)) {
                        errors.push(`pageerror: ${message}`);
                    }
                });
                page.on('response', (res) => {
                    if (res.status() >= 400) {
                        failedRequests.push(`${res.status()} ${res.url()}`);
                        if (res.url().includes('worker')) {
                            errors.push(`worker request failed: ${res.url()} (HTTP ${res.status()})`);
                        }
                    }
                });

                const url = `http://localhost:${port}/index.html`;
                await page.goto(url, {timeout: 15000});
                await new Promise((r) => setTimeout(r, POST_LOAD_WAIT_MS));

                const diagnostics = () => [
                    `URL: ${url} (served from ${root})`,
                    '',
                    'Console messages:',
                    ...consoleMessages.map((m) => `  ${m}`),
                    '',
                    'Failed requests:',
                    ...failedRequests.map((r) => `  ${r}`),
                    '',
                    'Captured errors:',
                    ...errors.map((e) => `  ${e}`)
                ].join('\n');

                const hasCanvas = await page.$('.maplibregl-canvas');
                if (!hasCanvas) {
                    throw new Error(`no .maplibregl-canvas element found after load\n\n${diagnostics()}`);
                }

                // The canvas appears even when the worker is dead, so it alone
                // proves very little. A broken worker URL, or a worker that
                // can't reach its `maplibre-gl-shared.mjs` sibling, produces a
                // map that mounts and then requests no vector tiles at all.
                for (let waited = 0; tileRequests.length === 0 && waited < TILE_WAIT_MS; waited += 500) {
                    await new Promise((r) => setTimeout(r, 500));
                }
                if (tileRequests.length === 0) {
                    throw new Error(`the map mounted but requested no vector tiles, which means the worker never started\n\n${diagnostics()}`);
                }

                expect(errors, `unexpected errors:\n  ${errors.join('\n  ')}`).toEqual([]);
            } finally {
                await page.close();
                server.close();
            }
        });
    }
});
