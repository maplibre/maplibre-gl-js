import {describe, test, expect} from 'vitest';
import {getGeoJSONBounds} from './geojson_bounds';

describe('getGeoJSONBounds', () => {
    test('get bounds from empty geometry', () => {
        const bounds = getGeoJSONBounds({
            type: 'LineString',
            coordinates: []
        });
        expect(bounds.isEmpty()).toBeTruthy();
    });

    test('get bounds from geometry collection', () => {
        const bounds = getGeoJSONBounds({
            type: 'GeometryCollection',
            geometries: [{
                type: 'LineString',
                coordinates: [
                    [1.1, 1.2],
                    [1.3, 1.4]
                ]
            }]
        });
        expect(bounds.getNorthEast().lat).toBe(1.4);
        expect(bounds.getNorthEast().lng).toBe(1.3);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });

    test('get bounds from feature', () => {
        const bounds = getGeoJSONBounds({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [1.1, 1.2],
                    [1.3, 1.4]
                ]
            }
        });
        expect(bounds.getNorthEast().lat).toBe(1.4);
        expect(bounds.getNorthEast().lng).toBe(1.3);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });

    test('get bounds from feature collection', () => {
        const bounds = getGeoJSONBounds({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [1.1, 1.2],
                        [1.3, 1.8]
                    ]
                }
            }, {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [1.5, 1.6],
                        [1.7, 1.4]
                    ]
                }
            }]
        });
        expect(bounds.getNorthEast().lat).toBe(1.8);
        expect(bounds.getNorthEast().lng).toBe(1.7);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });
});
