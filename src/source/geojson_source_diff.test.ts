import {describe, beforeEach, test, expect} from 'vitest';
import {setPerformance} from '../util/test/util';
import {type GeoJSONFeatureId, isUpdateableGeoJSON, toUpdateable, applySourceDiff} from './geojson_source_diff';

beforeEach(() => {
    setPerformance();
});

describe('isUpdateableGeoJSON', () => {
    test('feature without id is not updateable', () => {
        // no feature id -> false
        expect(isUpdateableGeoJSON({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            properties: {},
        })).toBe(false);
    });

    test('feature with id is updateable', () => {
        // has a feature id -> true
        expect(isUpdateableGeoJSON({
            type: 'Feature',
            id: 'feature_id',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            properties: {},
        })).toBe(true);
    });

    test('promoteId missing is not updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'Feature',
            id: 'feature_id',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            properties: {},
        }, 'propId')).toBe(false);
    });

    test('promoteId present is updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            properties: {
                propId: 'feature_id',
            },
        }, 'propId')).toBe(true);
    });

    test('feature collection with unique ids is updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 'feature_id',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {},
            }, {
                type: 'Feature',
                id: 'feature_id_2',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {},
            }]
        })).toBe(true);
    });

    test('feature collection with unique promoteIds is updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {
                    propId: 'feature_id',
                },
            }, {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {
                    propId: 'feature_id_2',
                },
            }]
        }, 'propId')).toBe(true);
    });

    test('feature collection without unique ids is not updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {},
            }]
        })).toBe(false);
    });

    test('feature collection with duplicate feature ids is not updateable', () => {
        expect(isUpdateableGeoJSON({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 'feature_id',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {},
            }, {
                type: 'Feature',
                id: 'feature_id',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {},
            }]
        })).toBe(false);
    });

    test('geometries are not updateable', () => {
        expect(isUpdateableGeoJSON({type: 'Point', coordinates: [0, 0]})).toBe(false);
    });
});

describe('toUpdateable', () => {
    test('works with a single feature - feature id', () => {
        const updateable = toUpdateable({
            type: 'Feature',
            id: 'point',
            geometry: {
                type: 'Point',
                coordinates: [0, 0],
            }, properties: {}});
        expect(updateable.size).toBe(1);
        expect(updateable.has('point')).toBeTruthy();
    });

    test('works with a single feature - promoteId', () => {
        const updateable2 = toUpdateable({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0],
            }, properties: {
                promoteId: 'point',
            }}, 'promoteId');
        expect(updateable2.size).toBe(1);
        expect(updateable2.has('point')).toBeTruthy();
    });

    test('works with a FeatureCollection - feature id', () => {
        const updateable = toUpdateable({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    id: 'point',
                    geometry: {
                        type: 'Point',
                        coordinates: [0, 0],
                    }, properties: {}},
                {
                    type: 'Feature',
                    id: 'point2',
                    geometry: {
                        type: 'Point',
                        coordinates: [0, 0],
                    }, properties: {}}
            ]
        });
        expect(updateable.size).toBe(2);
        expect(updateable.has('point')).toBeTruthy();
        expect(updateable.has('point2')).toBeTruthy();
    });

    test('works with a FeatureCollection - promoteId', () => {
        const updateable2 = toUpdateable({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [0, 0],
                    }, properties: {
                        promoteId: 'point'
                    }},
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [0, 0],
                    }, properties: {
                        promoteId: 'point2'
                    }}
            ]
        }, 'promoteId');
        expect(updateable2.size).toBe(2);
        expect(updateable2.has('point')).toBeTruthy();
        expect(updateable2.has('point2')).toBeTruthy();
    });
});

describe('applySourceDiff', () => {
    const point: GeoJSON.Feature = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
    };

    const point2: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [0, 0],
        },
        properties: {
            promoteId: 'point2'
        },
    };

    // freeze our input data to guarantee that applySourceDiff works immutably
    Object.freeze(point);
    Object.freeze(point.geometry);
    Object.freeze((point.geometry as GeoJSON.Point).coordinates);
    Object.freeze(point.properties);
    Object.freeze(point2);
    Object.freeze(point2.geometry);
    Object.freeze((point2.geometry as GeoJSON.Point).coordinates);
    Object.freeze(point2.properties);

    test('adds a feature using the feature id', () => {
        const updateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();

        applySourceDiff(updateable, {
            add: [point]
        });
        expect(updateable.size).toBe(1);
        expect(updateable.has('point')).toBeTruthy();
    });

    test('adds a feature using the promoteId', () => {
        const updateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();
        applySourceDiff(updateable, {
            add: [point2]
        }, 'promoteId');
        expect(updateable.size).toBe(1);
        expect(updateable.has('point2')).toBeTruthy();
    });

    test('removes a feature by its id', () => {
        const updateable = new Map([['point', point], ['point2', point2]]);
        applySourceDiff(updateable, {
            remove: ['point2'],
        });
        expect(updateable.size).toBe(1);
        expect(updateable.has('point2')).toBeFalsy();
    });

    test('updates a feature geometry', () => {
        const updateable = new Map([['point', point]]);
        // update -> new geometry
        applySourceDiff(updateable, {
            update: [{
                id: 'point',
                newGeometry: {
                    type: 'Point',
                    coordinates: [1, 0]
                }
            }]
        });
        expect(updateable.size).toBe(1);
        expect((updateable.get('point')?.geometry as GeoJSON.Point).coordinates[0]).toBe(1);
    });

    test('adds properties', () => {
        const updateable = new Map([['point', point]]);
        applySourceDiff(updateable, {
            update: [{
                id: 'point',
                addOrUpdateProperties: [
                    {key: 'prop', value: 'value'},
                    {key: 'prop2', value: 'value2'}
                ]
            }]
        });
        expect(updateable.size).toBe(1);
        const properties = updateable.get('point')?.properties!;
        expect(Object.keys(properties)).toHaveLength(2);
        expect(properties.prop).toBe('value');
        expect(properties.prop2).toBe('value2');
    });

    test('updates properties', () => {
        const updateable = new Map([['point', {...point, properties: {prop: 'value', prop2: 'value2'}}]]);
        applySourceDiff(updateable, {
            update: [{
                id: 'point',
                addOrUpdateProperties: [
                    {key: 'prop2', value: 'value3'}
                ]
            }]
        });
        expect(updateable.size).toBe(1);
        const properties2 = updateable.get('point')?.properties!;
        expect(Object.keys(properties2)).toHaveLength(2);
        expect(properties2.prop).toBe('value');
        expect(properties2.prop2).toBe('value3');
    });

    test('removes properties', () => {
        const updateable = new Map([['point', {...point, properties: {prop: 'value', prop2: 'value2'}}]]);
        applySourceDiff(updateable, {
            update: [{
                id: 'point',
                removeProperties: ['prop2']
            }]
        });
        expect(updateable.size).toBe(1);
        const properties3 = updateable.get('point')?.properties!;
        expect(Object.keys(properties3)).toHaveLength(1);
        expect(properties3.prop).toBe('value');
    });

    test('removes all properties', () => {
        const updateable = new Map([['point', {...point, properties: {prop: 'value', prop2: 'value2'}}]]);
        applySourceDiff(updateable, {
            update: [{
                id: 'point',
                removeAllProperties: true,
            }]
        });
        expect(updateable.size).toBe(1);
        expect(Object.keys(updateable.get('point')?.properties!)).toHaveLength(0);
    });
});
