import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {GeoJSONFeature} from './vectortile_to_geojson.ts';
import {EXTENT} from '../data/extent.ts';
import {CrsWorldCoordinateHelper, simpleCrs} from '../geo/projection/crs.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';

import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

function createPointFeature(x: number, y: number): VectorTileFeatureLike {
    return {
        type: 1,
        id: undefined,
        extent: EXTENT,
        properties: {},
        loadGeometry: () => [[new Point(x, y)]]
    };
}

describe('GeoJSONFeature.geometry', () => {
    test('unprojects a point a quarter into tile 0/0/0 with mercator on a mercator map', () => {
        const feature = new GeoJSONFeature(createPointFeature(EXTENT / 4, EXTENT / 4), 0, 0, 0, undefined, mercatorWorldCoordinateHelper);

        const coordinates = (feature.geometry as GeoJSON.Point).coordinates;

        expect(coordinates[0]).toBe(-90);
        expect(coordinates[1]).toBeCloseTo(66.51326, 6);
    });

    test('unprojects a point a quarter into tile 0/0/0 with the map projection on a planar map', () => {
        const feature = new GeoJSONFeature(createPointFeature(EXTENT / 4, EXTENT / 4), 0, 0, 0, undefined, new CrsWorldCoordinateHelper(simpleCrs));

        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([-45, 45]);
    });
});
