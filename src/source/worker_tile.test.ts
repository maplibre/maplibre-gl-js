import {describe, test, expect, vi} from 'vitest';
import {WorkerTile} from '../source/worker_tile';
import {type Feature, GeoJSONWrapper} from '@maplibre/vt-pbf';
import {OverscaledTileID} from '../source/tile_id';
import {StyleLayerIndex} from '../style/style_layer_index';
import {type WorkerTileParameters} from './worker_source';
import {type VectorTile} from '@mapbox/vector-tile';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import {type EvaluationParameters} from '../style/evaluation_parameters';
import {type PossiblyEvaluated} from '../style/properties';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {type CirclePaintProps, type CirclePaintPropsPossiblyEvaluated} from '../style/style_layer/circle_style_layer_properties.g';
import {type SymbolLayoutProps, type SymbolLayoutPropsPossiblyEvaluated} from '../style/style_layer/symbol_style_layer_properties.g';
import {MessageType} from '../util/actor_messages';

function createWorkerTile(params?: {globalState?: Record<string, any>}): WorkerTile {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1,
        globalState: params?.globalState
    } as any as WorkerTileParameters);
}

function createWrapper() {
    return new GeoJSONWrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    } as any as Feature]);
}

function createLineWrapper() {
    return new GeoJSONWrapper([{
        type: 2,
        geometry: [[0, 0], [1, 1]],
        tags: {}
    } as any as Feature]);
}

describe('worker tile', () => {
    test('WorkerTile.parse', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'circle'
        }]);

        const tile = createWorkerTile();
        const result = await tile.parse(createWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets[0]).toBeTruthy();
    });

    test('WorkerTile.parse layer with layout property', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'line',
            layout: {
                'line-join': 'bevel'
            }
        }]);

        const tile = createWorkerTile();
        const result = await tile.parse(createLineWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets[0]).toBeTruthy();
        expect(result.buckets[0].layers[0].layout._values['line-join'].value.value).toBe('bevel');
    });

    test('WorkerTile.parse layer with layout property using global-state', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'line',
            layout: {
                'line-join': ['global-state', 'test']
            }
        }], {test: 'bevel'});

        const tile = createWorkerTile({
            globalState: {test: 'bevel'}
        });
        const result = await tile.parse(createLineWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets[0]).toBeTruthy();
        expect(result.buckets[0].layers[0].layout._values['line-join'].value.value).toBe('bevel');
    });

    test('WorkerTile.parse layer with paint property using global-state', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'fill-extrusion',
            paint: {
                'fill-extrusion-height': ['global-state', 'test']
            }
        }], {test: 1});

        const tile = createWorkerTile({
            globalState: {test: 1}
        });
        const result = await tile.parse(createLineWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        expect(result.buckets[0]).toBeTruthy();
        expect(result.buckets[0].layers[0].paint._values['fill-extrusion-height'].value.value).toBe(1);
    });

    test('WorkerTile.parse skips hidden layers', async () => {
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

    test('WorkerTile.parse skips layers without a corresponding source layer', async () => {
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

    test('WorkerTile.parse warns once when encountering a v1 vector tile layer', async () => {
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

    test('WorkerTile.parse would request all types of dependencies', async () => {
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
        }, {
            id: 'line-layer',
            type: 'line',
            source: 'source',
            'source-layer': 'test',
            paint: {
                'line-dasharray': ['case', ['has', 'road_type'], ['literal', [2, 1]], ['literal', [1, 2]]]
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
            if (message.type === MessageType.getImages) {
                return Promise.resolve({'hello': {width: 1, height: 1, data: new Uint8Array([0])}});
            } else if (message.type === MessageType.getGlyphs) {
                return Promise.resolve({'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}});
            } else if (message.type === MessageType.getDashes) {
                return Promise.resolve({
                    '2,1,false': {y: 0, height: 16, width: 256},
                    '1,2,false': {y: 16, height: 16, width: 256}
                });
            }
        });

        const actorMock = {
            sendAsync
        };
        const result = await tile.parse(data, layerIndex, ['hello'], actorMock, SubdivisionGranularitySetting.noSubdivision);
        expect(result).toBeDefined();
        expect(sendAsync).toHaveBeenCalledTimes(4); // icons, patterns, glyphs, dashes
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({type: 'GI', data: expect.objectContaining({'icons': ['hello'], 'type': 'icons'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({type: 'GI', data: expect.objectContaining({'icons': ['hello'], 'type': 'patterns'})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({type: 'GG', data: expect.objectContaining({'source': 'source', 'type': 'glyphs', 'stacks': {'StandardFont-Bold': [101, 115, 116]}})}), expect.any(Object));
        expect(sendAsync).toHaveBeenCalledWith(expect.objectContaining({type: 'GDA', data: expect.objectContaining({'dashes': expect.any(Object)})}), expect.any(Object));
    });

    test('WorkerTile.parse would cancel and only event once on repeated reparsing', async () => {
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

    test('WorkerTile.parse passes global-state to layout properties', async () => {
        const globalState = {} as any;
        const layerIndex = new StyleLayerIndex([
            {
                id: 'layer-id',
                type: 'symbol',
                source: 'source',
                layout: {
                    'text-size': ['global-state', 'size']
                }
            }
        ], globalState);

        const tile = createWorkerTile({globalState});
        globalState.size = 12;
        await tile.parse(createLineWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        const layer = layerIndex._layers['layer-id'];
        layer.recalculate({} as EvaluationParameters, []);
        const layout = layer.layout as PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;
        expect(layout.get('text-size').evaluate({} as any, {})).toBe(12);
    });

    test('WorkerTile.parse passes global-state to paint properties', async () => {
        const layerIndex = new StyleLayerIndex([
            {
                id: 'circle',
                type: 'circle',
                source: 'source',
                paint: {
                    'circle-color': ['global-state', 'color'],
                    'circle-radius': ['global-state', 'radius']
                }
            }
        ], {radius: 15, color: '#FF0000'});

        const tile = createWorkerTile({});
        await tile.parse(createLineWrapper(), layerIndex, [], {} as any, SubdivisionGranularitySetting.noSubdivision);
        const layer = layerIndex._layers['circle'];
        layer.recalculate({zoom: 0} as EvaluationParameters, []);
        const paint = layer.paint as PossiblyEvaluated<CirclePaintProps, CirclePaintPropsPossiblyEvaluated>;
        expect(paint.get('circle-color').evaluate({} as any, {})).toEqual(new Color(1, 0, 0, 1));
        expect(paint.get('circle-radius').evaluate({} as any, {})).toBe(15);
    });
});
