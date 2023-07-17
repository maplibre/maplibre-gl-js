import {WorkerTile} from '../source/worker_tile';
import {GeoJSONWrapper, Feature} from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import {StyleLayerIndex} from '../style/style_layer_index';
import {WorkerTileParameters} from './worker_source';
import {Actor} from '../util/actor';
import {VectorTile} from '@mapbox/vector-tile';

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1
    } as any as WorkerTileParameters);
}

function createWrapper() {
    return new GeoJSONWrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    } as any as Feature]);
}

describe('worker tile', () => {
    test('WorkerTile#parse', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'circle'
        }]);

        const tile = createWorkerTile();
        tile.parse(createWrapper(), layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets[0]).toBeTruthy();
            done();
        });
    });

    test('WorkerTile#parse skips hidden layers', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: {visibility: 'none'}
        }]);

        const tile = createWorkerTile();
        tile.parse(createWrapper(), layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets).toHaveLength(0);
            done();
        });
    });

    test('WorkerTile#parse skips layers without a corresponding source layer', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'nonesuch',
            type: 'fill'
        }]);

        const tile = createWorkerTile();
        tile.parse({layers: {}}, layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets).toHaveLength(0);
            done();
        });
    });

    test('WorkerTile#parse warns once when encountering a v1 vector tile layer', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'fill'
        }]);

        const data = {
            layers: {
                test: {
                    version: 1
                }
            }
        } as any as VectorTile;

        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const tile = createWorkerTile();
        tile.parse(data, layerIndex, [], {} as Actor, (err) => {
            expect(err).toBeFalsy();
            expect(spy.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
            done();
        });
    });

    test('WorkerTile#parse would request all types of dependencies', done => {
        const tile = createWorkerTile();
        const layerIndex = new StyleLayerIndex([{
            id: '1',
            type: 'fill',
            source: 'source',
            'source-layer': 'test',
            paint: {
                'fill-pattern': 'hello'
            }
        }, {
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        const data = {
            layers: {
                test: {
                    version: 2,
                    name: 'test',
                    extent: 8192,
                    length: 1,
                    feature: (featureIndex: number) => ({
                        extent: 8192,
                        type: 1,
                        id: featureIndex,
                        properties: {
                            name: 'test'
                        },
                        loadGeometry () {
                            return [[{x: 0, y: 0}]];
                        }
                    })
                }
            }
        } as any as VectorTile;

        const send = jest.fn().mockImplementation((type: string, data: unknown, callback: Function) => {
            setTimeout(() => callback(null,
                type === 'getImages' ?
                    {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                    {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}}
            ));
        });

        const actorMock = {
            send
        } as unknown as Actor;
        tile.parse(data, layerIndex, ['hello'], actorMock, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeDefined();
            expect(send).toHaveBeenCalledTimes(3);
            expect(send).toHaveBeenCalledWith('getImages', expect.objectContaining({'icons': ['hello'], 'type': 'icons'}), expect.any(Function));
            expect(send).toHaveBeenCalledWith('getImages', expect.objectContaining({'icons': ['hello'], 'type': 'patterns'}), expect.any(Function));
            expect(send).toHaveBeenCalledWith('getGlyphs', expect.objectContaining({'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}}), expect.any(Function));
            done();
        });
    });

    test('WorkerTile#parse would cancel and only event once on repeated reparsing', done => {
        const tile = createWorkerTile();
        const layerIndex = new StyleLayerIndex([{
            id: '1',
            type: 'fill',
            source: 'source',
            'source-layer': 'test',
            paint: {
                'fill-pattern': 'hello'
            }
        }, {
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        const data = {
            layers: {
                test: {
                    version: 2,
                    name: 'test',
                    extent: 8192,
                    length: 1,
                    feature: (featureIndex: number) => ({
                        extent: 8192,
                        type: 1,
                        id: featureIndex,
                        properties: {
                            name: 'test'
                        },
                        loadGeometry () {
                            return [[{x: 0, y: 0}]];
                        }
                    })
                }
            }
        } as any as VectorTile;

        let cancelCount = 0;
        const send = jest.fn().mockImplementation((type: string, data: unknown, callback: Function) => {
            const res = setTimeout(() => callback(null,
                type === 'getImages' ?
                    {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                    {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}}
            ));

            return {
                cancel: () => {
                    cancelCount += 1;
                    clearTimeout(res);
                }
            };
        });

        const actorMock = {
            send
        } as unknown as Actor;
        tile.parse(data, layerIndex, ['hello'], actorMock, () => done.fail('should not be called'));
        tile.parse(data, layerIndex, ['hello'], actorMock, () => done.fail('should not be called'));
        tile.parse(data, layerIndex, ['hello'], actorMock, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeDefined();
            expect(cancelCount).toBe(6);
            expect(send).toHaveBeenCalledTimes(9);
            expect(send).toHaveBeenCalledWith('getImages', expect.objectContaining({'icons': ['hello'], 'type': 'icons'}), expect.any(Function));
            expect(send).toHaveBeenCalledWith('getImages', expect.objectContaining({'icons': ['hello'], 'type': 'patterns'}), expect.any(Function));
            expect(send).toHaveBeenCalledWith('getGlyphs', expect.objectContaining({'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}}), expect.any(Function));
            done();
        });
    });
});
