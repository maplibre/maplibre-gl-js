import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {sliceVectorTileLayer} from './vector_tile_overzoomed.ts';
import {CanonicalTileID} from '../tile/tile_id.ts';

import type {VectorTileFeatureLike, VectorTileLayerLike} from '@maplibre/vt-pbf';

/**
 * A layer with one polygon that covers the whole tile and more.
 */
function createPolygonLayer(extent: number): VectorTileLayerLike {
    const feature: VectorTileFeatureLike = {
        type: 3,
        properties: {},
        id: 1,
        extent,
        loadGeometry: () => [[
            new Point(-extent, -extent),
            new Point(2 * extent, -extent),
            new Point(2 * extent, 2 * extent),
            new Point(-extent, 2 * extent),
            new Point(-extent, -extent)
        ]]
    };
    return {
        name: 'layer',
        extent,
        version: 2,
        length: 1,
        feature: () => feature
    };
}

function getBounds(layer: VectorTileLayerLike) {
    const points = layer.feature(0).loadGeometry().flat();
    return {
        min: Math.min(...points.map(p => Math.min(p.x, p.y))),
        max: Math.max(...points.map(p => Math.max(p.x, p.y)))
    };
}

describe('sliceVectorTileLayer', () => {
    const maxZoomTileID = new CanonicalTileID(14, 8800, 5373);
    const targetTileID = new CanonicalTileID(16, 35201, 21493);

    test('clips with a buffer of 128 for the default extent', () => {
        const sliced = sliceVectorTileLayer(createPolygonLayer(4096), maxZoomTileID, targetTileID);

        expect(sliced.extent).toBe(4096);
        expect(getBounds(sliced)).toEqual({min: -128, max: 4096 + 128});
    });

    test('scales the buffer with the extent of the source tile', () => {
        const sliced = sliceVectorTileLayer(createPolygonLayer(65536), maxZoomTileID, targetTileID);

        expect(sliced.extent).toBe(65536);
        expect(getBounds(sliced)).toEqual({min: -2048, max: 65536 + 2048});
    });

    test('keeps the buffer of 128 for a smaller extent', () => {
        const sliced = sliceVectorTileLayer(createPolygonLayer(1024), maxZoomTileID, targetTileID);

        expect(sliced.extent).toBe(1024);
        expect(getBounds(sliced)).toEqual({min: -128, max: 1024 + 128});
    });

    test('drops features outside of the target tile', () => {
        const outsideTileID = new CanonicalTileID(16, 35300, 21600);
        const layer = createPolygonLayer(4096);
        const feature = layer.feature(0);
        feature.loadGeometry = () => [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 0)
        ]];

        const sliced = sliceVectorTileLayer(layer, maxZoomTileID, outsideTileID);

        expect(sliced).toHaveLength(0);
    });
});
