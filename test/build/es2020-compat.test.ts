import {describe, test, expect} from 'vitest';
import fs from 'fs';
import {transform} from 'esbuild';

describe('ES2020 compatibility (#7069)', () => {
    test('bundle does not require ES2022+ downleveling helpers', async () => {
        const bundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');

        // Simulate Vite's esbuild pipeline: transform the UMD bundle targeting es2020
        const result = await transform(bundle, {
            target: 'es2020',
            format: 'esm',
        });

        // If the bundle contains ES2022+ class fields, esbuild injects helper
        // functions (__publicField, _defineProperty) that won't be available
        // inside the Web Worker blob string, causing a runtime crash.
        // See: https://github.com/maplibre/maplibre-gl-js/issues/7069
        expect(result.code).not.toContain('__publicField');
        expect(result.code).not.toContain('_defineProperty');
    });
});
