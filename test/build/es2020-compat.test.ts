import {describe, test, expect} from 'vitest';
import fs from 'fs';
import {transform} from 'esbuild';

// Original context: in the v5 UMD build the worker source was inlined as a blob
// string. If a downstream consumer (e.g. Vite) downleveled the bundle to es2020,
// esbuild injected `__publicField` helpers at module scope that weren't visible
// inside the worker string, crashing at runtime (#7069).
//
// The v6 ESM build ships the worker as a separate `.mjs` file, so that exact bug
// can't recur. We still keep the assertion as a guard: maplibre staying free of
// ES2022+ class-field/private-field helpers means consumers targeting es2020
// don't pay an extra runtime helper cost.
describe('ES2020 compatibility (#7069)', () => {
    for (const file of ['dist/maplibre-gl.mjs', 'dist/maplibre-gl-worker.mjs']) {
        test(`${file} does not require ES2022+ downleveling helpers`, async () => {
            const bundle = fs.readFileSync(file, 'utf8');

            const result = await transform(bundle, {
                target: 'es2020',
                format: 'esm',
            });

            expect(result.code).not.toContain('__publicField');
            expect(result.code).not.toContain('_defineProperty');
        });
    }
});
