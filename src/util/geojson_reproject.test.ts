import {describe, expect, test} from 'vitest';
import {reprojectGeoJSONFromPseudoLngLat, reprojectGeoJSONToPseudoLngLat} from './geojson_reproject.ts';
import {CrsWorldCoordinateHelper, simpleCrs} from '../geo/projection/crs.ts';
import {latFromMercatorY} from '../geo/mercator_coordinate.ts';

type Positions = GeoJSON.Position | Positions[];

function createSimpleHelper() {
    return new CrsWorldCoordinateHelper(simpleCrs);
}

function expectPositionsClose(actual: Positions, expected: Positions) {
    expect(actual).toHaveLength(expected.length);
    if (typeof actual[0] === 'number') {
        for (let i = 0; i < actual.length; i++) expect(actual[i]).toBeCloseTo(expected[i] as number, 9);
        return;
    }
    for (let i = 0; i < actual.length; i++) expectPositionsClose(actual[i] as Positions, expected[i] as Positions);
}

describe('reprojectGeoJSONToPseudoLngLat', () => {
    test('moves a simple-CRS position to the lng/lat mercator maps to the same world position', () => {
        const point: GeoJSON.Point = {type: 'Point', coordinates: [45, 45]};
        expectPositionsClose(reprojectGeoJSONToPseudoLngLat(point, createSimpleHelper()).coordinates, [90, latFromMercatorY(0.25)]);
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
        expectPositionsClose(polygon.coordinates[0][2], [90, latFromMercatorY(0.25)]);
        const collection = result.features[1].geometry as GeoJSON.GeometryCollection;
        expectPositionsClose((collection.geometries[1] as GeoJSON.Point).coordinates, [90, 0]);
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
        expectPositionsClose((geometries[0] as GeoJSON.Point).coordinates, [-30, -30, 500]);
        expectPositionsClose((geometries[1] as GeoJSON.MultiPolygon).coordinates, [[[[0, 0, 1], [45, 0, 2], [45, 45, 3], [0, 0, 1]]]]);
    });
});
