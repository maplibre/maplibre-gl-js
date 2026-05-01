import {describe, test, expect} from 'vitest';
import fs from 'fs';
import {transformWithOxc} from 'vite';

describe('ES2022 compatibility (#7069)', () => {
    for (const file of ['dist/maplibre-gl.mjs', 'dist/maplibre-gl-worker.mjs']) {
        test(`${file} does not require ES2022+ downleveling helpers`, async () => {
            const bundle = fs.readFileSync(file, 'utf8');

            const result = await transformWithOxc(bundle, file, {
                target: 'es2022',
            });

            expect(result.code).not.toContain('__publicField');
            expect(result.code).not.toContain('_defineProperty');
        });
    }
});
