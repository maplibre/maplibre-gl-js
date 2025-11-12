import {describe, beforeEach, test, expect} from 'vitest';
import {setPerformance} from '../util/test/util';
import {type GeoJSONFeatureId, type GeoJSONSourceDiff, isUpdateableGeoJSON, toUpdateable, applySourceDiff, mergeSourceDiffs} from './geojson_source_diff';

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

    test('adds a feature with properties, removes the feature, then adds it back with different geometry and properties', () => {
        const updateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();

        const add1: GeoJSON.Feature = {
            type: 'Feature',
            id: 'feature1',
            geometry: {
                type: 'LineString',
                coordinates: [[0, 0], [1, 1]]
            },
            properties: {test1: 'test1'}
        };
        const add2: GeoJSON.Feature = {
            type: 'Feature',
            id: 'feature1',
            geometry: {
                type: 'Point',
                coordinates: [1, 1]
            },
            properties: {test2: 'test2'}
        };

        applySourceDiff(updateable, {
            add: [add1]
        });
        applySourceDiff(updateable, {
            remove: ['feature1']
        });
        applySourceDiff(updateable, {
            add: [add2]
        });

        expect(updateable.size).toBe(1);
        expect(updateable.has('feature1')).toBeTruthy();

        const feature = updateable.get('feature1');
        expect(feature.geometry).toEqual({type: 'Point', coordinates: [1, 1]});
        expect(feature.properties.test1).toBeUndefined();
        expect(feature.properties.test2).toBe('test2');
    });
});

describe('mergeSourceDiffs', () => {
    test('merges two diffs with different features ids', () => {
        const diff1 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
            remove: ['feature2'],
            update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{type: 'Feature', id: 'feature4', geometry: {type: 'Point', coordinates: [2, 2]}, properties: {}}],
            remove: ['feature5'],
            update: [{id: 'feature6', addOrUpdateProperties: [{key: 'prop', value: 'value'}]}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.add).toHaveLength(2);
        expect(merged.remove).toHaveLength(2);
        expect(merged.update).toHaveLength(2);
    });

    test('merges two diffs with equivalent feature ids', () => {
        const diff1 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {param: 1}}],
            remove: ['feature2'],
            update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [2, 2]}, properties: {param: 2}}],
            remove: ['feature2', 'feature4'],
            update: [{id: 'feature3', addOrUpdateProperties: [{key: 'prop2', value: 'value'}], removeProperties: ['prop3'], removeAllProperties: true}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.add).toHaveLength(1);
        expect(merged.add[0].geometry).toEqual({type: 'Point', coordinates: [2, 2]});
        expect(merged.add[0].properties).toEqual({param: 2});
        expect(merged.remove).toHaveLength(2);
        expect(merged.update).toHaveLength(1);
        expect(merged.update[0].newGeometry).toBeDefined();
        expect(merged.update[0].addOrUpdateProperties).toHaveLength(1);
        expect(merged.update[0].removeProperties).toBeUndefined();
        expect(merged.update[0].removeAllProperties).toBe(true);
    });

    test('merges two diffs add then removeAll', () => {
        const diff1 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            removeAll: true,
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.add).toHaveLength(0);
        expect(merged.removeAll).toBe(true);
    });

    test('merges two diffs removeAll then add', () => {
        const diff1 = {
            removeAll: true,
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.add).toHaveLength(1);
        expect(merged.removeAll).toBe(true);
    });

    test('merges two diffs with removeAll and add in both', () => {
        const diff1 = {
            removeAll: true,
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            removeAll: true,
            add: [{type: 'Feature', id: 'feature2', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.removeAll).toBe(true);
        expect(merged.add).toHaveLength(1);
        expect(merged.add[0].id).toBe('feature2');
    });

    test('removeAll in new diff clears explicit remove lists', () => {
        const diff1 = {
            remove: ['a']
        } satisfies GeoJSONSourceDiff;
        const diff2 = {
            removeAll: true,
            remove: ['b']
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.removeAll).toBe(true);
        expect(merged.remove).toHaveLength(0);
    });

    test('removeAllProperties wipes earlier feature property operations (add/update/remove)', () => {
        const diff1 = {
            update: [{
                id: 'f1',
                addOrUpdateProperties: [{key: 'new', value: 1}],
                removeProperties: ['old']
            }]
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            update: [{
                id: 'f1',
                removeAllProperties: true,
                addOrUpdateProperties: [{key: 'fresh', value: 2}]
            }]
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.update.length).toBe(1);
        expect(merged.update[0].removeAllProperties).toBe(true);
        expect(merged.update[0].removeProperties).toBeUndefined();
        expect(merged.update[0].addOrUpdateProperties).toEqual([{key: 'fresh', value: 2}]);
    });

    test('remove and add same feature using promote id', () => {
        const diff1 = {
            remove: ['pid']
        } satisfies GeoJSONSourceDiff;
        const diff2 = {
            add: [{
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {promoted: 'pid'}
            }],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2, 'promoted');
        expect(merged.add).toHaveLength(1);
        expect(merged.remove).toHaveLength(0);
    });

    test('add two separate features using promote id', () => {
        const diff1 = {
            add: [{
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {promoted: 'pid1'}
            }],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [1, 1]},
                properties: {promoted: 'pid2'}
            }],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2, 'promoted');
        expect(merged.add).toBeDefined();
        expect(merged.add.length).toBe(2);
    });

    test('merges two diffs update feature then remove', () => {
        const diff1 = {
            update: [{id: 'feature1', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            remove: ['feature1']
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.update).toHaveLength(0);
        expect(merged.remove).toHaveLength(1);
    });

    test('merges two diffs update feature properties then remove feature properties - and retains the remove', () => {
        const diff1 = {
            update: [{id: 'feature1', addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}]
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            update: [{id: 'feature1', removeProperties: ['prop1']}]
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.update[0].addOrUpdateProperties).toHaveLength(0);
        // Since a feature with the same id could have been added to the source previously, retain the remove.
        expect(merged.update[0].removeProperties).toHaveLength(1);
    });

    test('merges two diffs remove feature properties then update feature properties - retains both operations', () => {
        const diff1 = {
            update: [{id: 'feature1', removeProperties: ['prop1']}]
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            update: [{id: 'feature1', addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}]
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.update[0].removeProperties).toHaveLength(1);
        expect(merged.update[0].addOrUpdateProperties).toHaveLength(1);
    });

    test('merges two diffs add feature then remove - and retains the remove', () => {
        const diff1 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            remove: ['feature1']
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged.add).toHaveLength(0);
        // Since a feature with the same id could have been added to the source previously, retain the remove.
        expect(merged.remove).toHaveLength(1);
    });

    test('merges two diffs remove feature then add', () => {
        const diff1 = {
            remove: ['feature1']
        } satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const diff3 = {
            remove: ['feature1']
        } satisfies GeoJSONSourceDiff;

        const merged1 = mergeSourceDiffs(diff1, diff2);
        expect(merged1.add).toHaveLength(1);
        expect(merged1.remove).toHaveLength(0);

        const merged2 = mergeSourceDiffs(merged1, diff3);
        expect(merged2.add).toHaveLength(0);
        // Since a feature with the same id could have been added to the source previously, retain the remove.
        expect(merged2.remove).toHaveLength(1);
    });

    test('merges diff with empty', () => {
        const diff1 = {} satisfies GeoJSONSourceDiff;

        const diff2 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
            remove: ['feature2'],
            update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, diff2);
        expect(merged).toEqual(diff2);
    });

    test('merges diff with undefined', () => {
        const diff1 = {
            add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
        } satisfies GeoJSONSourceDiff;

        const merged = mergeSourceDiffs(diff1, undefined);
        expect(merged).toEqual(diff1);
    });

    test('merges two undefined diffs', () => {
        const merged = mergeSourceDiffs(undefined, undefined);
        expect(merged).toEqual({});
    });
});
