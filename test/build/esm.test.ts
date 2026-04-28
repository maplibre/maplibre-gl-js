import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

// `import()` would otherwise re-parse and re-evaluate every call; cache the
// load result per file so multiple assertions don't pay for it.
const loadEsm = (relPath: string) => import(pathToFileURL(path.resolve(relPath)).href);

// The worker bundle reads `self` at the top level (it's the worker scope).
// In Node we don't have `self`, so polyfill it once before any worker import.
(globalThis as any).self ??= globalThis;

describe('ESM build', () => {
    test('main bundle exports the public API', async () => {
        const mod = await loadEsm('dist/maplibre-gl-dev.mjs');
        expect(typeof mod.Map).toBe('function');
        expect(typeof mod.Marker).toBe('function');
        expect(typeof mod.Popup).toBe('function');
        expect(typeof mod.setWorkerUrl).toBe('function');
        expect(typeof mod.getWorkerUrl).toBe('function');
    });

    test('worker bundle loads as an ES module', async () => {
        const workerPath = 'dist/maplibre-gl-worker-dev.mjs';
        const content = fs.readFileSync(workerPath, 'utf8');
        // Smoke checks before evaluating: clearer failure messages than a
        // generic ReferenceError from a misformatted bundle.
        expect(content).not.toContain('define.amd'); // not AMD
        expect(content).toContain('Actor');          // worker entry got bundled
        await expect(loadEsm(workerPath)).resolves.toBeDefined();
    });

    test('production main bundle exports the public API (if built)', async () => {
        if (!fs.existsSync('dist/maplibre-gl.mjs')) return;
        const mod = await loadEsm('dist/maplibre-gl.mjs');
        expect(typeof mod.Map).toBe('function');
        expect(typeof mod.setWorkerUrl).toBe('function');
    });

    test('production worker bundle loads as an ES module (if built)', async () => {
        if (!fs.existsSync('dist/maplibre-gl-worker.mjs')) return;
        await expect(loadEsm('dist/maplibre-gl-worker.mjs')).resolves.toBeDefined();
    });

});
