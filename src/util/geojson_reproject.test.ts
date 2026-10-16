import {describe, expect, test} from 'vitest';
import {reprojectGeoJSONFromWorld, reprojectGeoJSONSourceDiffToWorld, reprojectGeoJSONToWorld} from './geojson_reproject.ts';
import {CRSWorldCoordinateHelper, identityCrs} from '../geo/projection/crs.ts';

import type {GeoJSONSourceDiff} from '../source/geojson_source_diff.ts';

function createIdentityHelper() {
    return new CRSWorldCoordinateHelper(identityCrs);
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
