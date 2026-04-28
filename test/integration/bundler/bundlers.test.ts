import {describe, beforeAll, afterAll, test, expect} from 'vitest';
import {type Browser, type Page} from 'puppeteer';
import {execSync} from 'node:child_process';
import {existsSync, readdirSync, statSync} from 'node:fs';
import http, {type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import st from 'st';

import {launchPuppeteer} from '../lib/puppeteer_config';

// Smoke-tests each bundler example under `test/bundler/`:
//   1. `npm install` (copies the parent's `dist/` via the `file:` dependency)
//   2. `npm run build`
//   3. Open the built page in headless Chrome and verify the worker loads
//      and the maplibre canvas appears.
//
// Catches the runtime worker-URL bugs that build-only checks miss, e.g. the
// "Loading Worker from … was blocked because of a disallowed MIME type" case.

const POST_LOAD_WAIT_MS = 2000;
const TEST_TIMEOUT_MS = 180000;

// Headless-Chrome / SwiftShader quirks that aren't bundler bugs.
const ENV_NOISE = [
    /webglcontextcreationerror/i,
    /failed to initialize webgl/i,
    /swiftshader/i
];
const isEnvNoise = (text: string) => ENV_NOISE.some((re) => re.test(text));

const bundlerDir = 'test/integration/bundler';
// Use forward-slash paths throughout: Node's `fs` accepts them on both POSIX
// and Windows, and they're directly usable as URL path segments later.
const examples = readdirSync(bundlerDir, {withFileTypes: true})
    .filter((e) => e.isDirectory() && statSync(path.join(bundlerDir, e.name)).isDirectory())
    .map((e) => `${bundlerDir}/${e.name}`)
    .sort();

let server: Server;
let browser: Browser;
let port: number;

describe('Bundler examples', () => {
    beforeAll(async () => {
        server = http.createServer(st(process.cwd()));
        await new Promise<void>((resolve) => server.listen(resolve));
        port = (server.address() as AddressInfo).port;
        browser = await launchPuppeteer();
    }, 60000);

    afterAll(async () => {
        if (browser) await browser.close();
        if (server) server.close();
    });

    for (const dir of examples) {
        test(`${dir} builds and runs in a browser`, {timeout: TEST_TIMEOUT_MS}, async () => {
            execSync('npm install', {cwd: dir, stdio: 'inherit'});
            execSync('npm run build', {cwd: dir, stdio: 'inherit'});

            // Vite and webpack put index.html in dist/; esbuild and Rollup keep
            // it at the example root referencing the built bundle in dist/.
            const servedSubpath = existsSync(path.join(dir, 'dist', 'index.html'))
                ? `${dir}/dist/`
                : `${dir}/`;

            const errors: string[] = [];
            const page: Page = await browser.newPage();
            try {
                page.on('console', (msg) => {
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
                    if (res.url().includes('worker') && res.status() >= 400) {
                        errors.push(`worker request failed: ${res.url()} (HTTP ${res.status()})`);
                    }
                });

                await page.goto(`http://localhost:${port}/${servedSubpath}`, {timeout: 15000});
                await new Promise((r) => setTimeout(r, POST_LOAD_WAIT_MS));

                const hasCanvas = await page.$('.maplibregl-canvas');
                expect(hasCanvas, 'no .maplibregl-canvas element found after load').not.toBeNull();
                expect(errors, `unexpected errors:\n  ${errors.join('\n  ')}`).toEqual([]);
            } finally {
                await page.close();
            }
        });
    }
});
