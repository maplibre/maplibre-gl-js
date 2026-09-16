import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {GeoJSONFeature} from './vectortile_to_geojson.ts';
import {EXTENT} from '../data/extent.ts';
import {CrsWorldCoordinateHelper, simpleCrs} from '../geo/projection/crs.ts';
import {mercatorWorldCoordinateHelper, latFromMercatorY} from '../geo/mercator_coordinate.ts';

import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

function createPointFeature(x: number, y: number): VectorTileFeatureLike {
    return {
        type: 1,
        extent: EXTENT,
        properties: {},
        loadGeometry: () => [[new Point(x, y)]]
    } as any as VectorTileFeatureLike;
}

describe('GeoJSONFeature.geometry', () => {
    test('unprojects a tile point with mercator on a mercator map and with the map projection on a planar map', () => {
        const mercator = new GeoJSONFeature(createPointFeature(EXTENT / 4, EXTENT / 4), 0, 0, 0, undefined, mercatorWorldCoordinateHelper);
        const simple = new GeoJSONFeature(createPointFeature(EXTENT / 4, EXTENT / 4), 0, 0, 0, undefined, new CrsWorldCoordinateHelper(simpleCrs));
        const mercatorCoordinates = (mercator.geometry as GeoJSON.Point).coordinates;
        expect(mercatorCoordinates[0]).toBe(-90);
        expect(mercatorCoordinates[1]).toBeCloseTo(latFromMercatorY(0.25), 10);
        expect((simple.geometry as GeoJSON.Point).coordinates).toEqual([-45, 45]);
    });

    test('a point at 1234/567 in tile 3/5/2 unprojects to 51.7786/65.2406 under mercator', () => {
        const feature = new GeoJSONFeature(createPointFeature(1234, 567), 3, 5, 2, undefined, mercatorWorldCoordinateHelper);
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates;
        expect(coordinates[0]).toBe(51.778564453125);
        expect(coordinates[1]).toBeCloseTo(65.24060730904736, 12);
    });

    test('does not serialize the helper', () => {
        const feature = new GeoJSONFeature(createPointFeature(0, 0), 0, 0, 0, 7, new CrsWorldCoordinateHelper(simpleCrs));
        expect(Object.keys(feature.toJSON())).toEqual(['geometry', 'type', 'properties', 'id']);
    });
});
