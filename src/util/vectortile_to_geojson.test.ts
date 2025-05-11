import {describe, expect, test} from 'vitest';
import {GeoJSONFeature} from './vectortile_to_geojson';
import type {MapGeoJSONFeature} from './vectortile_to_geojson';
import type {VectorTileFeature} from '@mapbox/vector-tile';

describe('vectortile_to_geojson', () => {
    const mockPointGeometry: GeoJSON.Geometry = {
        type: 'Point',
        coordinates: [100, 0]
    };

    const createMockVectorTileFeature = (properties = {}, extraFields = {}): VectorTileFeature => {
        return {
            properties,
            extent: 4096,
            type: 1,
            loadGeometry: () => [],
            toGeoJSON: (_x, _y, _z) => {
                return {
                    type: 'Feature',
                    geometry: mockPointGeometry,
                    properties: properties
                };
            },
            ...extraFields
        } as unknown as VectorTileFeature;
    };

    describe('GeoJSONFeature', () => {

        test('constructor properly initializes properties', () => {
            const mockProperties = {name: 'Test Feature', value: 42};
            const mockExtraFields = {extraField: 'extra value'};
            const id = 'feature-123';

            const vectorTileFeature = createMockVectorTileFeature(mockProperties, mockExtraFields);
            const feature = new GeoJSONFeature(vectorTileFeature, 14, 8254, 5463, id);

            expect(feature.type).toBe('Feature');
            expect(feature.properties).toEqual(mockProperties);
            expect(feature.id).toBe(id);

            expect((vectorTileFeature as any)._z).toBe(14);
            expect((vectorTileFeature as any)._x).toBe(8254);
            expect((vectorTileFeature as any)._y).toBe(5463);

            expect(feature.foreignMembers.extraField).toBe('extra value');

            expect(feature.foreignMembers.properties).toBeUndefined();
            expect(feature.foreignMembers.extent).toBeUndefined();
            expect(feature.foreignMembers.type).toBeUndefined();
        });

        test('geometry getter lazily loads geometry', () => {
            const vectorTileFeature = createMockVectorTileFeature();
            const feature = new GeoJSONFeature(vectorTileFeature, 14, 8254, 5463, 'feature-123');

            expect(feature._geometry).toBeUndefined();

            const geometry = feature.geometry;
            expect(geometry).toEqual(mockPointGeometry);

            expect(feature.geometry).toBe(geometry);
        });

        test('geometry setter updates _geometry', () => {
            const vectorTileFeature = createMockVectorTileFeature();
            const feature = new GeoJSONFeature(vectorTileFeature, 14, 8254, 5463, 'feature-123');

            const newGeometry: GeoJSON.Geometry = {
                type: 'LineString',
                coordinates: [[0, 0], [1, 1]]
            };

            feature.geometry = newGeometry;
            expect(feature._geometry).toBe(newGeometry);
            expect(feature.geometry).toBe(newGeometry);
        });

        test('toJSON outputs correct GeoJSON structure', () => {
            const mockProperties = {name: 'Test Feature', value: 42};
            const mockExtraFields = {extraField: 'extra value'};
            const id = 'feature-123';

            const vectorTileFeature = createMockVectorTileFeature(mockProperties, mockExtraFields);
            const feature = new GeoJSONFeature(vectorTileFeature, 14, 8254, 5463, id);

            feature.geometry;

            const json = feature.toJSON();

            expect(json.type).toBe('Feature');
            expect(json.geometry).toEqual(mockPointGeometry);
            expect(json.properties).toEqual(mockProperties);
            expect(json.id).toBe(id);
            expect(json.extraField).toBe('extra value');

            expect(json._geometry).toBeUndefined();
            expect(json._vectorTileFeature).toBeUndefined();
        });

        test('handles feature without id', () => {
            const vectorTileFeature = createMockVectorTileFeature();
            const feature = new GeoJSONFeature(vectorTileFeature, 14, 8254, 5463, undefined);

            expect(feature.id).toBeUndefined();

            const json = feature.toJSON();
            expect(json.id).toBeUndefined();
        });
    });

    describe('MapGeoJSONFeature type', () => {
        test('can create object of MapGeoJSONFeature type', () => {
            const mockVectorTileFeature = createMockVectorTileFeature({name: 'Test Feature'});
            const geoJSONFeature = new GeoJSONFeature(mockVectorTileFeature, 14, 8254, 5463, 'feature-123');

            const mapFeature = {
                ...geoJSONFeature.toJSON(),
                layer: {
                    id: 'test-layer',
                    type: 'fill',
                    source: 'test-source'
                },
                source: 'test-source',
                sourceLayer: 'test-source-layer',
                state: {
                    hover: false,
                    selected: true
                }
            } as MapGeoJSONFeature;

            expect(mapFeature.type).toBe('Feature');
            expect(mapFeature.geometry).toEqual(geoJSONFeature.geometry);
            expect(mapFeature.layer.id).toBe('test-layer');
            expect(mapFeature.layer.source).toBe('test-source');
            expect(mapFeature.source).toBe('test-source');
            expect(mapFeature.sourceLayer).toBe('test-source-layer');
            expect(mapFeature.state.hover).toBe(false);
            expect(mapFeature.state.selected).toBe(true);
        });
    });
});
