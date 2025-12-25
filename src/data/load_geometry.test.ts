import {describe, test, expect, beforeAll} from 'vitest';
import {loadGeometry} from './load_geometry';
import {loadVectorTile} from '../../test/unit/lib/tile';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

describe('loadGeometry', () => {
    let sourceLayer: VectorTileLayerLike;
    beforeAll(() => {
        // Load line features from fixture tile.
        sourceLayer = loadVectorTile().layers.road;
    });

    test('loadGeometry', () => {
        const feature = sourceLayer.feature(0);
        const originalGeometry = feature.loadGeometry();
        const scaledGeometry = loadGeometry(feature);
        expect(scaledGeometry[0][0].x).toBe(originalGeometry[0][0].x * 2);
        expect(scaledGeometry[0][0].y).toBe(originalGeometry[0][0].y * 2);
    });

    test('loadGeometry warns and clamps when exceeding extent', () => {
        const feature = sourceLayer.feature(0);
        feature.extent = 2048;

        let numWarnings = 0;

        // Use a custom console.warn to count warnings
        const warn = console.warn;
        console.warn = (warning) => {
            if (warning.match(/Geometry exceeds allowed extent, reduce your vector tile buffer size/)) {
                numWarnings++;
            }
        };

        const lines = loadGeometry(feature);

        expect(numWarnings).toBe(1);

        let maxValue = -Infinity;
        for (const line of lines) {
            for (const {x, y} of line) {
                maxValue = Math.max(x, y, maxValue);
            }
        }
        expect(maxValue).toBe(16383);

        // Put it back
        console.warn = warn;

    });
});
