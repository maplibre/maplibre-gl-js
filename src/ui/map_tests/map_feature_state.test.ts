import {createMap, beforeMapTest, createStyleSource} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#setFeatureState', () => {
    test('sets state', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toBe(true);
            done();
        });
    }));
    test('works with string ids', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toBe(true);
            done();
        });
    }));
    test('parses feature id as an int', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: '12345'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toBe(true);
            done();
        });
    }));
    test('throw before loaded', () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        expect(() => {
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
        }).toThrow(Error);
    });
    test('fires an error if source not found', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/source/);
                done();
            });
            map.setFeatureState({source: 'vector', id: 12345}, {'hover': true});
        });
    }));
    test('fires an error if sourceLayer not provided for a vector source', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'vector': {
                        'type': 'vector',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/sourceLayer/);
                done();
            });
            (map as any).setFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
        });
    }));
    test('fires an error if id not provided', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'vector': {
                        'type': 'vector',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/id/);
                done();
            });
            (map as any).setFeatureState({source: 'vector', sourceLayer: '1'}, {'hover': true});
        });
    }));
});

describe('#removeFeatureState', () => {

    test('accepts "0" id', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 0}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toBeUndefined();
            expect(fState.click).toBe(true);
            done();
        });
    }));
    test('accepts string id', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 'foo'}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toBeUndefined();
            expect(fState.click).toBe(true);
            done();
        });
    }));
    test('remove specific state property', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            map.removeFeatureState({source: 'geojson', id: 12345}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toBeUndefined();
            done();
        });
    }));
    test('remove all state properties of one feature', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1});

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.hover).toBeUndefined();
            expect(fState.foo).toBeUndefined();

            done();
        });
    }));
    test('remove properties for zero-based feature IDs.', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 0});

            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toBeUndefined();
            expect(fState.foo).toBeUndefined();

            done();
        });
    }));
    test('other properties persist when removing specific property', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1}, 'hover');

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.foo).toBe(true);

            done();
        });
    }));
    test('remove all state properties of all features in source', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson'});

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toBeUndefined();
            expect(fState1.foo).toBeUndefined();

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toBeUndefined();
            expect(fState2.foo).toBeUndefined();

            done();
        });
    }));
    test('specific state deletion should not interfere with broader state deletion', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson', id: 1});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toBeUndefined();

            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toBeUndefined();

            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 2}, 'foo');

            const fState3 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState3.hover).toBeUndefined();

            done();
        });
    }));
    test('add/remove and remove/add state', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            map.removeFeatureState({source: 'geojson', id: 12345});
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            const fState1 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState1.hover).toBe(true);

            map.removeFeatureState({source: 'geojson', id: 12345});

            const fState2 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState2.hover).toBeUndefined();

            done();
        });
    }));
    test('throw before loaded', () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        expect(() => {
            (map as any).removeFeatureState({source: 'geojson', id: 12345}, {'hover': true});
        }).toThrow(Error);
    });
    test('fires an error if source not found', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': createStyleSource()
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/source/);
                done();
            });
            (map as any).removeFeatureState({source: 'vector', id: 12345}, {'hover': true});
        });
    }));
    test('fires an error if sourceLayer not provided for a vector source', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'vector': {
                        'type': 'vector',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/sourceLayer/);
                done();
            });
            (map as any).removeFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
        });
    }));
    test('fires an error if state property is provided without a feature id', () => new Promise<void>(done => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'vector': {
                        'type': 'vector',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'layers': []
            }
        });
        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/id/);
                done();
            });
            (map as any).removeFeatureState({source: 'vector', sourceLayer: '1'}, {'hover': true});
        });
    }));
});
