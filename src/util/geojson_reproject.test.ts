import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {reprojectGeoJSONFromWorld, reprojectGeoJSONSourceDiffToWorld, reprojectGeoJSONToWorld} from './geojson_reproject.ts';
import {CRSWorldCoordinateHelper, identityCrs} from '../geo/projection/crs.ts';
import {polygonIntersectsBox, polygonIntersectsBufferedMultiLine, polygonIntersectsPolygon} from './intersection_tests.ts';
import {createPolarStereographicCrs} from './test/util.ts';

import type {GeoJSONSourceDiff} from '../source/geojson_source_diff.ts';

function createIdentityHelper() {
    return new CRSWorldCoordinateHelper(identityCrs);
}

function createPolarHelper() {
    return new CRSWorldCoordinateHelper(createPolarStereographicCrs());
}

describe('reprojectGeoJSONToWorld', () => {
    test('moves an identity-CRS position to its world coordinates', () => {
        const point: GeoJSON.Point = {type: 'Point', coordinates: [45, 45]};
        expect(reprojectGeoJSONToWorld(point, createIdentityHelper()).coordinates).toEqual([0.75, 0.25]);
    });

    test('keeps the altitude and any further ordinates', () => {
        const point: GeoJSON.Point = {type: 'Point', coordinates: [0, 0, 123, 4]};
        expect(reprojectGeoJSONToWorld(point, createIdentityHelper()).coordinates).toEqual([0.5, 0.5, 123, 4]);
    });

    test('walks features, collections, nested geometries and geometry collections without mutating the input', () => {
        const data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 'a',
                properties: {name: 'a'},
                geometry: {type: 'Polygon', coordinates: [[[0, 0], [45, 0], [45, 45], [0, 45], [0, 0]]]}
            }, {
                type: 'Feature',
                properties: null,
                geometry: {
                    type: 'GeometryCollection',
                    geometries: [
                        {type: 'MultiLineString', coordinates: [[[0, 0], [45, 45]]]},
                        {type: 'Point', coordinates: [45, 0]}
                    ]
                }
            }, {
                type: 'Feature',
                properties: {},
                geometry: null
            }]
        };
        const copy = JSON.parse(JSON.stringify(data));

        const result = reprojectGeoJSONToWorld(data, createIdentityHelper());

        expect(data).toEqual(copy);
        expect(result).not.toBe(data);
        expect(result.features[0].id).toBe('a');
        expect(result.features[0].properties).toBe(data.features[0].properties);
        expect(result.features[2].geometry).toBeNull();
        const polygon = result.features[0].geometry as GeoJSON.Polygon;
        expect(polygon.coordinates[0][2]).toEqual([0.75, 0.25]);
        const collection = result.features[1].geometry as GeoJSON.GeometryCollection;
        expect((collection.geometries[1] as GeoJSON.Point).coordinates).toEqual([0.75, 0.5]);
    });
});

describe('reprojectGeoJSONToWorld in a polar CRS, whose latitude range ends at 53 S', () => {
    test('keeps a polygon with an edge across the far pole out of the world square', () => {
        const isea4hSouthPoleCell: GeoJSON.Polygon = {type: 'Polygon', coordinates: [[
            [88.3853, -87.67805], [54.96953, -88.57819], [0, -89.52868], [180, -89.31865], [142.1755, -88.10424], [115.34565, -87.43262], [88.3853, -87.67805]
        ]]};
        const ring = reprojectGeoJSONToWorld(isea4hSouthPoleCell, createPolarHelper()).coordinates[0];
        expect(polygonIntersectsBox(ring.map(([x, y]) => new Point(x, y)), 0, 0, 1, 1)).toBe(false);
    });

    test('keeps a line along a parallel past the southern limit out of the world square', () => {
        const farParallel: GeoJSON.LineString = {type: 'LineString', coordinates: [[0, -80], [180, -80]]};
        const line = reprojectGeoJSONToWorld(farParallel, createPolarHelper()).coordinates.map(([x, y]) => new Point(x, y));
        const worldSquare = [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1), new Point(0, 0)];
        expect(polygonIntersectsBufferedMultiLine(worldSquare, [line], 0)).toBe(false);
    });

    test('fills an edge along the southern limit, so a polygon of the whole globe covers the world square', () => {
        const wholeGlobe: GeoJSON.Polygon = {type: 'Polygon', coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]]};
        const ring = reprojectGeoJSONToWorld(wholeGlobe, createPolarHelper()).coordinates[0];
        const worldRing = ring.map(([x, y]) => new Point(x, y));
        const insideWorldSquare = new Point(0.75, 0.75);
        expect(polygonIntersectsPolygon([insideWorldSquare], worldRing)).toBe(true);
    });
});

describe('reprojectGeoJSONToWorld in a polar CRS on a 1 km grid at 5 W, 70 N', () => {
    function createSmallGridHelper() {
        const polar = createPolarStereographicCrs();
        const [x, y] = polar.projection.forward([-5, 70]);
        return new CRSWorldCoordinateHelper({...polar, tileMatrixSet: {origin: [x - 500, y + 500], extentAtZoom0: 1000}});
    }

    test('keeps a polygon that covers the grid over all of it', () => {
        const rectangle: GeoJSON.Polygon = {type: 'Polygon', coordinates: [[[-20, 60], [10, 60], [10, 80], [-20, 80], [-20, 60]]]};
        const ring = reprojectGeoJSONToWorld(rectangle, createSmallGridHelper()).coordinates[0].map(([x, y]) => new Point(x, y));
        for (const [x, y] of [[0.5, 0.5], [0.01, 0.01], [0.99, 0.01], [0.99, 0.99], [0.01, 0.99]]) {
            expect(polygonIntersectsPolygon([new Point(x, y)], ring)).toBe(true);
        }
    });
});

describe('reprojectGeoJSONFromWorld', () => {
    test('round trips with reprojectGeoJSONToWorld, 3D coordinates and geometry collections included', () => {
        const feature: GeoJSON.Feature = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'GeometryCollection',
                geometries: [
                    {type: 'Point', coordinates: [-30, -30, 500]},
                    {type: 'MultiPolygon', coordinates: [[[[0, 0, 1], [45, 0, 2], [45, 45, 3], [0, 0, 1]]]]}
                ]
            }
        };
        const roundTripped = reprojectGeoJSONFromWorld(reprojectGeoJSONToWorld(feature, createIdentityHelper()), createIdentityHelper());
        const geometries = (roundTripped.geometry as GeoJSON.GeometryCollection).geometries;
        expect((geometries[0] as GeoJSON.Point).coordinates).toEqual([expect.closeTo(-30, 9), expect.closeTo(-30, 9), 500]);
        expect((geometries[1] as GeoJSON.MultiPolygon).coordinates).toEqual([[[
            [expect.closeTo(0, 9), expect.closeTo(0, 9), 1],
            [expect.closeTo(45, 9), expect.closeTo(0, 9), 2],
            [expect.closeTo(45, 9), expect.closeTo(45, 9), 3],
            [expect.closeTo(0, 9), expect.closeTo(0, 9), 1]
        ]]]);
    });
});

describe('reprojectGeoJSONSourceDiffToWorld', () => {
    test('moves the added features and the replaced geometries, and keeps removals and property changes', () => {
        const diff = {
            remove: ['gone'],
            add: [{type: 'Feature', id: 'new', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}}],
            update: [
                {id: 'moved', newGeometry: {type: 'Point', coordinates: [45, 45]}},
                {id: 'renamed', addOrUpdateProperties: [{key: 'name', value: 'b'}]}
            ]
        } satisfies GeoJSONSourceDiff;

        const result = reprojectGeoJSONSourceDiffToWorld(diff, createIdentityHelper());

        expect(result.remove).toEqual(['gone']);
        expect((result.add[0].geometry as GeoJSON.Point).coordinates).toEqual([0.75, 0.25]);
        expect((result.update[0].newGeometry as GeoJSON.Point).coordinates).toEqual([0.75, 0.25]);
        expect(result.update[1]).toBe(diff.update[1]);
    });
});
