import {describe, expect, test} from 'vitest';
import {reprojectGeoJSONFromPseudoLngLat, reprojectGeoJSONToPseudoLngLat} from './geojson_reproject.ts';
import {CrsWorldCoordinateHelper, simpleCrs} from '../geo/projection/crs.ts';

/** lng/lat 45/45 is world (0.75, 0.25) in the simple CRS; mercator puts that world position at 90 E, this far north. */
const pseudoLatOf45 = 66.51326044;

function createSimpleHelper() {
    return new CrsWorldCoordinateHelper(simpleCrs);
}

describe('reprojectGeoJSONToPseudoLngLat', () => {
    test('moves a simple-CRS position to the lng/lat mercator maps to the same world position', () => {
        const point: GeoJSON.Point = {type: 'Point', coordinates: [45, 45]};
        expect(reprojectGeoJSONToPseudoLngLat(point, createSimpleHelper()).coordinates).toEqual([90, expect.closeTo(pseudoLatOf45, 6)]);
    });

    test('keeps the altitude and any further ordinates', () => {
        const point: GeoJSON.Point = {type: 'Point', coordinates: [0, 0, 123, 4]};
        expect(reprojectGeoJSONToPseudoLngLat(point, createSimpleHelper()).coordinates).toEqual([0, 0, 123, 4]);
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

        const result = reprojectGeoJSONToPseudoLngLat(data, createSimpleHelper());

        expect(data).toEqual(copy);
        expect(result).not.toBe(data);
        expect(result.features[0].id).toBe('a');
        expect(result.features[0].properties).toBe(data.features[0].properties);
        expect(result.features[2].geometry).toBeNull();
        const polygon = result.features[0].geometry as GeoJSON.Polygon;
        expect(polygon.coordinates[0][2]).toEqual([90, expect.closeTo(pseudoLatOf45, 6)]);
        const collection = result.features[1].geometry as GeoJSON.GeometryCollection;
        expect((collection.geometries[1] as GeoJSON.Point).coordinates).toEqual([90, expect.closeTo(0, 9)]);
    });
});

describe('reprojectGeoJSONFromPseudoLngLat', () => {
    test('round trips with reprojectGeoJSONToPseudoLngLat, 3D coordinates and geometry collections included', () => {
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
        const roundTripped = reprojectGeoJSONFromPseudoLngLat(reprojectGeoJSONToPseudoLngLat(feature, createSimpleHelper()), createSimpleHelper());
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
