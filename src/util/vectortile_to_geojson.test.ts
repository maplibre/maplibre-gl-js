import {describe, expect, test} from 'vitest';
import fs from 'fs';
import path from 'path';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import {GeoJSONFeature} from './vectortile_to_geojson.ts';
import {EXTENT} from '../data/extent.ts';
import {CRSWorldCoordinateHelper, identityCrs} from '../geo/projection/crs.ts';
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
        const feature = new GeoJSONFeature(createPointFeature(EXTENT / 4, EXTENT / 4), 0, 0, 0, undefined, new CRSWorldCoordinateHelper(identityCrs));

        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([-45, 45]);
    });
});

describe('GeoJSONFeature', () => {
    test('can be cloned on a map in a registered projection', () => {
        const rawTileData = fs.readFileSync(path.join(__dirname, '/../../test/unit/assets/mbsv5-6-18-23.vector.pbf'));
        const placeLabel = new VectorTile(new PbfReader(rawTileData)).layers['place_label'].feature(0);
        const worldCoordinateHelper = new CRSWorldCoordinateHelper({
            name: 'test:clone',
            projection: {forward: ([lng, lat]) => [lng, lat], inverse: ([x, y]) => [x, y]},
            tileMatrixSet: {origin: [-90, 90], extentAtZoom0: 180}
        });
        const feature = new GeoJSONFeature(placeLabel, 6, 18, 23, undefined, worldCoordinateHelper);

        expect(() => structuredClone(feature)).not.toThrow();
    });
});
