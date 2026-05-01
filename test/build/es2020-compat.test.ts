import {describe, test, expect} from 'vitest';
import fs from 'fs';
import {transform} from 'esbuild';

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
