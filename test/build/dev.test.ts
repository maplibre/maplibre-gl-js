import {describe, test, expect} from 'vitest';
import fs from 'fs';

describe('dev build', () => {
    test('main bundle is not empty', () => {
        expect(fs.readFileSync('dist/maplibre-gl-dev.mjs', 'utf8').length).toBeGreaterThan(0);
    });

    test('worker bundle is not empty', () => {
        expect(fs.readFileSync('dist/maplibre-gl-worker-dev.mjs', 'utf8').length).toBeGreaterThan(0);
    });
});
