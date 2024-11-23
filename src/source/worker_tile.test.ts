import {describe, test, expect, vi} from 'vitest';
import {WorkerTile} from '../source/worker_tile';
import {GeoJSONWrapper, type Feature} from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import {StyleLayerIndex} from '../style/style_layer_index';
import {type WorkerTileParameters} from './worker_source';
import {type VectorTile} from '@mapbox/vector-tile';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';

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
    test('WorkerTile#parse', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'circle'
        }]);

        const tile = createWorkerTile();
        const result = await tile.parse(createWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets[0]).toBeTruthy();
    });

    test('WorkerTile#parse skips hidden layers', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: {visibility: 'none'}
        }]);

        const tile = createWorkerTile();
        const result = await tile.parse(createWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets).toHaveLength(0);
    });

    test('WorkerTile#parse skips layers without a corresponding source layer', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'nonesuch',
            type: 'fill'
        }]);

        const tile = createWorkerTile();
        const result = await tile.parse({layers: {}}, layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets).toHaveLength(0);
    });

    test('WorkerTile#parse warns once when encountering a v1 vector tile layer', async () => {
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

        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const tile = createWorkerTile();
        await tile.parse(data, layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(spy.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
    });

    test('WorkerTile#parse would request all types of dependencies', async () => {
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

        const sendAsync = vi.fn().mockImplementation((message: {type: string; data: any}) => {
            const response = message.type === 'getImages' ?
                {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}};
            return Promise.resolve(response);
        });

        const actorMock = {
            sendAsync
        };
        const result = await tile.parse(data, layerIndex, ['hello'], actorMock, SubdivisionGranularitySetting.noSubdivision);
        expect(result).toBeDefined();
        expect(sendAsync).toHaveBeenCalledTimes(3);
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'icons': ['hello'], 'type': 'icons'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'icons': ['hello'], 'type': 'patterns'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}})}), expect.any(Object));
    });

    test('WorkerTile#parse would cancel and only event once on repeated reparsing', async () => {
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
        const sendAsync = vi.fn().mockImplementation((message: {type: string; data: unknown}, abortController: AbortController) => {
            return new Promise((resolve, _reject) => {
                const res = setTimeout(() => {
                    const response = message.type === 'getImages' ?
                        {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                        {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}};
                    resolve(response);
                }
                );
                abortController.signal.addEventListener('abort', () => {
                    cancelCount += 1;
                    clearTimeout(res);
                });
            });
        });

        const actorMock = {
            sendAsync
        };
        tile.parse(data, layerIndex, ['hello'], actorMock, SubdivisionGranularitySetting.noSubdivision).then(() => expect(false).toBeTruthy());
        tile.parse(data, layerIndex, ['hello'], actorMock, SubdivisionGranularitySetting.noSubdivision).then(() => expect(false).toBeTruthy());
        const result = await tile.parse(data, layerIndex, ['hello'], actorMock, SubdivisionGranularitySetting.noSubdivision);
        expect(result).toBeDefined();
        expect(cancelCount).toBe(6);
        expect(sendAsync).toHaveBeenCalledTimes(9);
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'icons': ['hello'], 'type': 'icons'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'icons': ['hello'], 'type': 'patterns'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}})}), expect.any(Object));
    });
});
