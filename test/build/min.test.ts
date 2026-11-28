import {describe, test, expect} from 'vitest';
import fs from 'fs';
import packageJson from '../../package.json' assert {type: 'json'};

describe('production bundle', () => {
    const mainBundle = fs.readFileSync('dist/maplibre-gl.mjs', 'utf8');

    test('main bundle does not leak package.json script strings', () => {
        for (const name in packageJson.scripts) {
            const cmd = packageJson.scripts[name];
            if (cmd.length < 10) continue; // skip trivially-short commands
            expect(mainBundle).not.toContain(cmd);
        }
    });

    test('worker bundle excludes style validation and layer types without buckets', () => {
        const workerMap: {sources: string[]} = JSON.parse(fs.readFileSync('dist/maplibre-gl-worker.mjs.map', 'utf8'));
        const forbidden = [
            '/src/style/validate_style.ts',
            '/maplibre-gl-style-spec/dist/validate/',
            '/src/style/style_layer/background_style_layer.ts',
            '/src/style/style_layer/color_relief_style_layer.ts',
            '/src/style/style_layer/custom_style_layer.ts',
            '/src/style/style_layer/hillshade_style_layer.ts',
            '/src/style/style_layer/raster_style_layer.ts',
        ];
        const leaked = workerMap.sources.filter(source => forbidden.some(pattern => source.includes(pattern)));
        expect(leaked).toEqual([]);
    });
});
