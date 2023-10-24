import {WorkerTile} from '../source/worker_tile';
import {GeoJSONWrapper, Feature} from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import {StyleLayerIndex} from '../style/style_layer_index';
import {WorkerTileParameters} from './worker_source';
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
        tile.parse(createWrapper(), layerIndex, [], {} as any).then((result) => {
            expect(result.buckets[0]).toBeTruthy();
            done();
        }).catch(done.fail);
    });

    test('WorkerTile#parse skips hidden layers', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: {visibility: 'none'}
        }]);

        const tile = createWorkerTile();
        tile.parse(createWrapper(), layerIndex, [], {} as any).then((result) => {
            expect(result.buckets).toHaveLength(0);
            done();
        }).catch(done.fail);
    });

    test('WorkerTile#parse skips layers without a corresponding source layer', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'nonesuch',
            type: 'fill'
        }]);

        const tile = createWorkerTile();
        tile.parse({layers: {}}, layerIndex, [], {} as any).then((result) => {
            expect(result.buckets).toHaveLength(0);
            done();
        }).catch(done.fail);
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
        tile.parse(data, layerIndex, [], {} as any).then(() => {
            expect(spy.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
            done();
        }).catch(done.fail);
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


        const sendAsync = jest.fn().mockImplementation((message: {type: string, data: unknown}) => {
            const response = message.type === 'getImages' ?
                {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}}
            return Promise.resolve(response);
        });

        const actorMock = {
            sendAsync
        };
        tile.parse(data, layerIndex, ['hello'], actorMock).then((result) => {
            expect(result).toBeDefined();
            expect(sendAsync).toHaveBeenCalledTimes(3);
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: {'icons': ['hello'], 'type': 'icons'}}));
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: {'icons': ['hello'], 'type': 'patterns'}}));
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: {'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}}}));
            done();
        }).catch(done.fail);
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
        const sendAsync = jest.fn().mockImplementation((message: {type: string, data: unknown}, abortController: AbortController) => {
            return new Promise((resolve, _reject) => {
                const res = setTimeout(() => {
                        const response = message.type === 'getImages' ?
                            {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                            {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}}
                        resolve(response);
                    }
                );
                abortController.signal.addEventListener('abort', () => {
                    cancelCount += 1;
                    clearTimeout(res);
                });
            })
        });

        const actorMock = {
            sendAsync
        };
        tile.parse(data, layerIndex, ['hello'], actorMock).then(() => done.fail('should not be called'));
        tile.parse(data, layerIndex, ['hello'], actorMock).then(() => done.fail('should not be called'));
        tile.parse(data, layerIndex, ['hello'], actorMock).then((result) => {
            expect(result).toBeDefined();
            expect(cancelCount).toBe(6);
            expect(sendAsync).toHaveBeenCalledTimes(9);
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: { 'icons': ['hello'], 'type': 'icons'} }));
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: {'icons': ['hello'], 'type': 'patterns'} }));
            expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: {'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}}}));
            done();
        }).catch(done.fail);
    });
});
