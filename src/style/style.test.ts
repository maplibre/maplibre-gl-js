import {describe, beforeEach, afterEach, test, expect, vi, type MockInstance} from 'vitest';
import {Style} from './style';
import {SourceCache} from '../source/source_cache';
import {StyleLayer} from './style_layer';
import {extend} from '../util/util';
import {Event} from '../util/evented';
import {RGBAImage} from '../util/image';
import {rtlMainThreadPluginFactory} from '../source/rtl_text_plugin_main_thread';
import {browser} from '../util/browser';
import {OverscaledTileID} from '../source/tile_id';
import {fakeServer, type FakeServer} from 'nise';

import {type EvaluationParameters} from './evaluation_parameters';
import {type LayerSpecification, type GeoJSONSourceSpecification, type FilterSpecification, type SourceSpecification, type StyleSpecification, type SymbolLayerSpecification, type SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import {type GeoJSONSource} from '../source/geojson_source';
import {StubMap, sleep} from '../util/test/util';
import {RTLPluginLoadedEventName} from '../source/rtl_text_plugin_status';
import {MessageType} from '../util/actor_messages';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {type Tile} from '../source/tile';
import type Point from '@mapbox/point-geometry';

function createStyleJSON(properties?): StyleSpecification {
    return extend({
        'version': 8,
        'sources': {},
        'layers': []
    }, properties);
}

function createSource() {
    return {
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        attribution: 'MapLibre',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    } as any as SourceSpecification;
}

function createGeoJSONSource(): GeoJSONSourceSpecification {
    return {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': []
        }
    };
}

const getStubMap = () => new StubMap() as any;

function createStyle(map = getStubMap()) {
    const style = new Style(map);
    map.style = style;
    return style;
}

let server: FakeServer;
let mockConsoleError: MockInstance;

beforeEach(() => {
    global.fetch = null;
    server = fakeServer.create();
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
    server.restore();
    mockConsoleError.mockRestore();
});

describe('Style', () => {
    test('RTL plugin load reloads vector source but not raster source', async() => {
        const map = getStubMap();
        const style = new Style(map);
        map.style = style;
        style.loadJSON({
            'version': 8,
            'sources': {
                'raster': {
                    type: 'raster',
                    tiles: ['http://tiles.server']
                },
                'vector': {
                    type: 'vector',
                    tiles: ['http://tiles.server']
                }
            },
            'layers': [{
                'id': 'raster',
                'type': 'raster',
                'source': 'raster'
            }]
        });

        await style.once('style.load');
        vi.spyOn(style.sourceCaches['raster'], 'reload');
        vi.spyOn(style.sourceCaches['vector'], 'reload');

        rtlMainThreadPluginFactory().fire(new Event(RTLPluginLoadedEventName));

        expect(style.sourceCaches['raster'].reload).not.toHaveBeenCalled();
        expect(style.sourceCaches['vector'].reload).toHaveBeenCalled();
    });
});

describe('Style#loadURL', () => {
    test('fires "dataloading"', () => {
        const style = new Style(getStubMap());
        const spy = vi.fn();

        style.on('dataloading', spy);
        style.loadURL('style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toBe(style);
        expect(spy.mock.calls[0][0].dataType).toBe('style');
    });

    test('transforms style URL before request', () => {
        const map = getStubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');

        const style = new Style(map);
        style.loadURL('style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('style.json');
        expect(spy.mock.calls[0][1]).toBe('Style');
    });

    test('validates the style', () => new Promise<void>(done => {
        const style = new Style(getStubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            expect(error.message).toMatch(/version/);
            done();
        });

        style.loadURL('style.json');
        server.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        server.respond();
    }));

    test('cancels pending requests if removed', () => {
        const style = new Style(getStubMap());
        style.loadURL('style.json');
        style._remove();
        expect((server.lastRequest as any).aborted).toBe(true);
    });

    test('does not fire an error if removed', async () => {
        const style = new Style(getStubMap());
        const spy = vi.fn();

        style.on('error', spy);
        style.loadURL('style.json');
        style._remove();
        await sleep(0);

        expect(spy).not.toHaveBeenCalled();
    });

    test('fires an error if the request fails', async () => {
        const style = new Style(getStubMap());
        const errorStatus = 400;

        const promise = style.once('error');
        style.loadURL('style.json');
        server.respondWith(request => request.respond(errorStatus));
        server.respond();
        const {error} = await promise;

        expect(error).toBeTruthy();
        expect(error.status).toBe(errorStatus);
    });
});

describe('Style#loadJSON', () => {
    test('serialize() returns undefined until style is loaded', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        expect(style.serialize()).toBeUndefined();
        await style.once('style.load');
        expect(style.serialize()).toEqual(createStyleJSON());
    });

    test('fires "dataloading" (synchronously)', () => {
        const style = new Style(getStubMap());
        const spy = vi.fn();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toBe(style);
        expect(spy.mock.calls[0][0].dataType).toBe('style');
    });

    test('fires "data" (asynchronously)', async () => {
        const style = new Style(getStubMap());

        style.loadJSON(createStyleJSON());

        const e = await style.once('data');
        expect(e.target).toBe(style);
        expect(e.dataType).toBe('style');
    });

    test('fires "data" when the sprite finishes loading', async () => {
        // Stubbing to bypass Web APIs that supported by jsdom:
        // * `URL.createObjectURL` in ajax.getImage (https://github.com/tmpvar/jsdom/issues/1721)
        // * `canvas.getContext('2d')` in browser.getImageData
        vi.spyOn(browser, 'getImageData');
        // stub Image so we can invoke 'onload'
        // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c

        server.respondWith('GET', 'http://example.com/sprite.png', new ArrayBuffer(8));
        server.respondWith('GET', 'http://example.com/sprite.json', '{}');

        const style = new Style(getStubMap());

        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [],
            'sprite': 'http://example.com/sprite'
        });

        style.once('error', (e) => expect(e).toBeFalsy());

        const e = await style.once('data');
        expect(e.target).toBe(style);
        expect(e.dataType).toBe('style');

        const promise = style.once('data');
        server.respond();

        await promise;
        expect(e.target).toBe(style);
        expect(e.dataType).toBe('style');
    });

    test('Validate sprite image extraction', async () => {
        // Stubbing to bypass Web APIs that supported by jsdom:
        // * `URL.createObjectURL` in ajax.getImage (https://github.com/tmpvar/jsdom/issues/1721)
        // * `canvas.getContext('2d')` in browser.getImageData
        vi.spyOn(browser, 'getImageData');
        // stub Image so we can invoke 'onload'
        // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c

        server.respondWith('GET', 'http://example.com/sprite.png', new ArrayBuffer(8));
        server.respondWith('GET', 'http://example.com/sprite.json', '{"image1": {"width": 1, "height": 1, "x": 0, "y": 0, "pixelRatio": 1.0}}');

        const style = new Style(getStubMap());

        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [],
            'sprite': 'http://example.com/sprite'
        });

        const firstDataEvent = await style.once('data');
        expect(firstDataEvent.target).toBe(style);
        expect(firstDataEvent.dataType).toBe('style');

        const secondDataPromise = style.once('data');

        server.respond();

        const secondDateEvent = await secondDataPromise;
        expect(secondDateEvent.target).toBe(style);
        expect(secondDateEvent.dataType).toBe('style');
        const response = await style.imageManager.getImages(['image1']);
        const image = response['image1'];
        expect(image.data).toBeInstanceOf(RGBAImage);
        expect(image.data.width).toBe(1);
        expect(image.data.height).toBe(1);
        expect(image.pixelRatio).toBe(1);
    });

    test('validates the style', async () => {
        const style = new Style(getStubMap());

        const promise = style.once('error');
        style.loadJSON(createStyleJSON({version: 'invalid'}));
        const {error} = await promise;

        expect(error).toBeTruthy();
        expect(error.message).toMatch(/version/);
    });

    test('creates sources', async () => {
        const style = createStyle();

        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapLibre': {
                    'type': 'vector',
                    'tiles': []
                }
            }
        }));

        await style.once('style.load');
        expect(style.sourceCaches['mapLibre'] instanceof SourceCache).toBeTruthy();
    });

    test('creates layers', async () => {
        const style = createStyle();

        style.loadJSON({
            'version': 8,
            'sources': {
                'foo': {
                    'type': 'vector'
                }
            },
            'layers': [{
                'id': 'fill',
                'source': 'foo',
                'source-layer': 'source-layer',
                'type': 'fill'
            }]
        });

        await style.once('style.load');
        expect(style.getLayer('fill') instanceof StyleLayer).toBeTruthy();
    });

    test('transforms sprite json and image URLs before request', async () => {
        const map = getStubMap();
        const transformSpy = vi.spyOn(map._requestManager, 'transformRequest');
        const style = createStyle(map);

        style.loadJSON(extend(createStyleJSON(), {
            'sprite': 'http://example.com/sprites/bright-v8'
        }));

        await style.once('style.load');

        expect(transformSpy).toHaveBeenCalledTimes(2);
        expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/sprites/bright-v8.json');
        expect(transformSpy.mock.calls[0][1]).toBe('SpriteJSON');
        expect(transformSpy.mock.calls[1][0]).toBe('http://example.com/sprites/bright-v8.png');
        expect(transformSpy.mock.calls[1][1]).toBe('SpriteImage');
    });

    test('emits an error on non-existant vector source layer', () => new Promise<void>(done => {
        const style = createStyle();
        style.loadJSON(createStyleJSON({
            sources: {
                '-source-id-': {type: 'vector', tiles: []}
            },
            layers: []
        }));

        style.on('style.load', () => {
            style.removeSource('-source-id-');

            const source = createSource();
            source['vector_layers'] = [{id: 'green'}];
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
            style.update({} as EvaluationParameters);
        });

        style.on('error', (event) => {
            const err = event.error;
            expect(err).toBeTruthy();
            expect(err.toString().indexOf('-source-layer-') !== -1).toBeTruthy();
            expect(err.toString().indexOf('-source-id-') !== -1).toBeTruthy();
            expect(err.toString().indexOf('-layer-id-') !== -1).toBeTruthy();

            done();
        });
    }));

    test('sets up layer event forwarding', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', (e) => {
            expect(e.layer).toEqual({id: 'background'});
            expect(e.mapLibre).toBeTruthy();
            done();
        });

        style.on('style.load', () => {
            style._layers.background.fire(new Event('error', {mapLibre: true}));
        });
    }));

    test('sets terrain if defined', async () => {
        const map = getStubMap();
        const style = new Style(map);
        map.setTerrain = vi.fn();
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()},
            terrain: {source: 'source-id', exaggeration: 0.33}
        }));

        await style.once('style.load');

        expect(style.map.setTerrain).toHaveBeenCalled();
    });

    test('applies transformStyle function', async () => {
        const previousStyle = createStyleJSON({
            sources: {
                base: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            },
            layers: [{
                id: 'layerId0',
                type: 'circle',
                source: 'base'
            }, {
                id: 'layerId1',
                type: 'circle',
                source: 'base'
            }]
        });

        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON(), {
            transformStyle: (prevStyle, nextStyle) => ({
                ...nextStyle,
                sources: {
                    ...nextStyle.sources,
                    base: prevStyle.sources.base
                },
                layers: [
                    ...nextStyle.layers,
                    prevStyle.layers[0]
                ]
            })
        }, previousStyle);

        await style.once('style.load');

        expect('base' in style.stylesheet.sources).toBeTruthy();
        expect(style.stylesheet.layers[0].id).toBe(previousStyle.layers[0].id);
        expect(style.stylesheet.layers).toHaveLength(1);
    });
});

describe('Style#_load', () => {
    test('initiates sprite loading when it\'s present', () => {
        const style = new Style(getStubMap());

        const prevStyleSpec = createStyleJSON({
            sprite: 'https://example.com/test1'
        });

        const nextStyleSpec = createStyleJSON({
            sprite: 'https://example.com/test2'
        });

        const _loadSpriteSpyOn = vi.spyOn(style, '_loadSprite');
        style._load(nextStyleSpec, {}, prevStyleSpec);

        expect(_loadSpriteSpyOn).toHaveBeenCalledTimes(1);
    });

    test('does not initiate sprite loading when it\'s absent (undefined)', () => {
        const style = new Style(getStubMap());

        const prevStyleSpec = createStyleJSON({
            sprite: 'https://example.com/test1'
        });

        const nextStyleSpec = createStyleJSON({sprite: undefined});

        const _loadSpriteSpyOn = vi.spyOn(style, '_loadSprite');
        style._load(nextStyleSpec, {}, prevStyleSpec);

        expect(_loadSpriteSpyOn).not.toHaveBeenCalled();
    });

    test('layers are broadcasted to worker', () => {
        const style = new Style(getStubMap());
        let dispatchType: MessageType;
        let dispatchData;
        const styleSpec = createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        });

        const _broadcastSpyOn = vi.spyOn(style.dispatcher, 'broadcast')
            .mockImplementation((type, data) => {
                dispatchType = type;
                dispatchData = data;
                return Promise.resolve({} as any);
            });

        style._load(styleSpec, {});

        expect(_broadcastSpyOn).toHaveBeenCalled();
        expect(dispatchType).toBe(MessageType.setLayers);

        expect(dispatchData).toHaveLength(1);
        expect(dispatchData[0].id).toBe('background');

        // cleanup
        _broadcastSpyOn.mockRestore();
    });

    test('validate style when validate option is true', () => {
        const style = new Style(getStubMap());
        const styleSpec = createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }, {
                id: 'custom',
                type: 'custom'
            }]
        });
        const stub = vi.spyOn(console, 'error');

        style._load(styleSpec, {validate: true});

        // 1. layers[1]: missing required property "source"
        // 2. layers[1].type: expected one of [fill, line, symbol, circle, heatmap, fill-extrusion, raster, hillshade, background], "custom" found
        expect(stub).toHaveBeenCalledTimes(2);

        // cleanup
        stub.mockReset();
    });

    test('layers are NOT serialized immediately after creation', () => {
        const style = new Style(getStubMap());
        const styleSpec = createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }, {
                id: 'custom',
                type: 'custom'
            }]
        });

        style._load(styleSpec, {validate: false});
        expect(style._serializedLayers).toBeNull();
    });

    test('projection is mercator if not specified', () => {
        const style = new Style(getStubMap());
        const styleSpec = createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        });

        style._load(styleSpec, {validate: false});
        expect(style.projection.name).toBe('mercator');
        expect(style.serialize().projection).toBeUndefined();
    });
});

describe('Style#_remove', () => {
    test('removes cache sources and clears their tiles', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        await style.once('style.load');
        const sourceCache = style.sourceCaches['source-id'];
        vi.spyOn(sourceCache, 'setEventedParent');
        vi.spyOn(sourceCache, 'onRemove');
        vi.spyOn(sourceCache, 'clearTiles');

        style._remove();

        expect(sourceCache.setEventedParent).toHaveBeenCalledWith(null);
        expect(sourceCache.onRemove).toHaveBeenCalledWith(style.map);
        expect(sourceCache.clearTiles).toHaveBeenCalled();
    });

    test('deregisters plugin listener', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        vi.spyOn(rtlMainThreadPluginFactory(), 'off');

        await style.once('style.load');
        style._remove();

        expect(rtlMainThreadPluginFactory().off).toHaveBeenCalled();
    });
});

describe('Style#update', () => {
    test('on error', () => new Promise<void>(done => {
        const style = createStyle();
        style.loadJSON({
            'version': 8,
            'sources': {
                'source': {
                    'type': 'vector'
                }
            },
            'layers': [{
                'id': 'second',
                'source': 'source',
                'source-layer': 'source-layer',
                'type': 'fill'
            }]
        });

        style.on('error', (error) => { expect(error).toBeFalsy(); });

        style.on('style.load', () => {
            style.addLayer({id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer'}, 'second');
            style.addLayer({id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer'});
            style.removeLayer('second');

            style.dispatcher.broadcast = (key, value) => {
                expect(key).toBe(MessageType.updateLayers);
                expect(value['layers'].map((layer) => { return layer.id; })).toEqual(['first', 'third']);
                expect(value['removedIds']).toEqual(['second']);
                done();
                return Promise.resolve({} as any);
            };

            style.update({} as EvaluationParameters);
        });
    }));
});

describe('Style#setState', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setState(createStyleJSON())).toThrow(/load/i);
    });

    test('do nothing if there are no changes', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        const spys = [];
        spys.push(vi.spyOn(style, 'addLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setPaintProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayoutProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setFilter').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'addSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setGeoJSONSourceData').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayerZoomRange').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLight').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setSky').mockImplementation((() => {}) as any));
        await style.once('style.load');
        const didChange = style.setState(createStyleJSON());
        expect(didChange).toBeFalsy();
        for (const spy of spys) {
            expect(spy).not.toHaveBeenCalled();
        }
    });

    test('do operations if there are changes', async () => {
        const style = createStyle();
        const styleJson = createStyleJSON({
            layers: [{
                id: 'layerId0',
                type: 'symbol',
                source: 'sourceId0',
                'source-layer': '123'
            }, {
                id: 'layerId1',
                type: 'circle',
                source: 'sourceId1',
                'source-layer': ''
            }],
            sources: {
                sourceId0: createGeoJSONSource(),
                sourceId1: createGeoJSONSource(),
            },
            light: {
                anchor: 'viewport'
            },
            sky: {
                'atmosphere-blend': 0
            }
        });
        style.loadJSON(styleJson);

        await style.once('style.load');
        const spys = [];
        spys.push(vi.spyOn(style, 'addLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setPaintProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayoutProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setFilter').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'addSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayerZoomRange').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLight').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setGeoJSONSourceData').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setGlyphs').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setSprite').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setProjection').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style.map, 'setTerrain').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setSky').mockImplementation((() => {}) as any));

        const newStyle = JSON.parse(JSON.stringify(styleJson)) as StyleSpecification;
        newStyle.layers[0].paint = {'text-color': '#7F7F7F',};
        newStyle.layers[0].layout = {'text-size': 16,};
        newStyle.layers[0].minzoom = 2;
        (newStyle.layers[0] as SymbolLayerSpecification).filter = ['==', 'id', 1];
        newStyle.layers.splice(1, 1);
        newStyle.sources['foo'] = createSource();
        delete newStyle.sources['sourceId1'];
        newStyle.light = {
            anchor: 'map'
        };
        newStyle.layers.push({
            id: 'layerId2',
            type: 'circle',
            source: 'sourceId0'
        });
        ((newStyle.sources.sourceId0 as GeoJSONSourceSpecification).data as GeoJSON.FeatureCollection).features.push({} as any);

        newStyle.glyphs = 'https://example.com/{fontstack}/{range}.pbf';
        newStyle.sprite = 'https://example.com';

        newStyle.terrain = {
            source: 'foo',
            exaggeration: 0.5
        };
        newStyle.zoom = 2;
        newStyle.projection = {type: 'globe'};

        newStyle.sky = {
            'fog-color': '#000001',
            'sky-color': '#000002',
            'horizon-fog-blend': 0.5,
            'atmosphere-blend': 1
        };
        const didChange = style.setState(newStyle);
        expect(didChange).toBeTruthy();
        for (const spy of spys) {
            expect(spy).toHaveBeenCalled();
        }
    });

    test('change transition doesn\'t change the style, but is considered a change', async () => {
        const style = createStyle();
        const styleJson = createStyleJSON();
        style.loadJSON(styleJson);

        await style.once('style.load');
        const spys = [];
        spys.push(vi.spyOn(style, 'addLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeLayer').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setPaintProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayoutProperty').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setFilter').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'addSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'removeSource').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLayerZoomRange').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setLight').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setGeoJSONSourceData').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setGlyphs').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setSprite').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style.map, 'setTerrain').mockImplementation((() => {}) as any));
        spys.push(vi.spyOn(style, 'setSky').mockImplementation((() => {}) as any));

        const newStyleJson = createStyleJSON();
        newStyleJson.transition = {duration: 5};
        const didChange = style.setState(newStyleJson);
        expect(didChange).toBeTruthy();
        for (const spy of spys) {
            expect(spy).not.toHaveBeenCalled();
        }
    });

    test('Issue #3893: compare new source options against originally provided options rather than normalized properties', async () => {
        server.respondWith('/tilejson.json', JSON.stringify({
            tiles: ['http://tiles.server']
        }));
        const initial = createStyleJSON();
        initial.sources.mySource = {
            type: 'raster',
            url: '/tilejson.json'
        };
        const style = new Style(getStubMap());
        style.loadJSON(initial);
        const promise = style.once('style.load');
        server.respond();
        await promise;
        const spyRemove = vi.spyOn(style, 'removeSource').mockImplementation((() => {}) as any);
        const spyAdd = vi.spyOn(style, 'addSource').mockImplementation((() => {}) as any);
        style.setState(initial);
        expect(spyRemove).not.toHaveBeenCalled();
        expect(spyAdd).not.toHaveBeenCalled();
    });

    test('return true if there is a change', async () => {
        const initialState = createStyleJSON();
        const nextState = createStyleJSON({
            sources: {
                foo: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            }
        });

        const style = new Style(getStubMap());
        style.loadJSON(initialState);
        await style.once('style.load');
        const didChange = style.setState(nextState);
        expect(didChange).toBeTruthy();
        expect(style.stylesheet).toEqual(nextState);
    });

    test('sets GeoJSON source data if different', async () => {
        const initialState = createStyleJSON({
            'sources': {'source-id': createGeoJSONSource()}
        });

        const geoJSONSourceData = {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [125.6, 10.1]
                    }
                }
            ]
        };

        const nextState = createStyleJSON({
            'sources': {
                'source-id': {
                    'type': 'geojson',
                    'data': geoJSONSourceData
                }
            }
        });

        const style = new Style(getStubMap());
        style.loadJSON(initialState);

        await style.once('style.load');
        const geoJSONSource = style.sourceCaches['source-id'].getSource() as GeoJSONSource;
        const mockStyleSetGeoJSONSourceDate = vi.spyOn(style, 'setGeoJSONSourceData');
        const mockGeoJSONSourceSetData = vi.spyOn(geoJSONSource, 'setData');
        const didChange = style.setState(nextState);

        expect(mockStyleSetGeoJSONSourceDate).toHaveBeenCalledWith('source-id', geoJSONSourceData);
        expect(mockGeoJSONSourceSetData).toHaveBeenCalledWith(geoJSONSourceData);
        expect(didChange).toBeTruthy();
        expect(style.stylesheet).toEqual(nextState);
    });

    test('updates stylesheet according to applied transformStyle function', async () => {
        const initialState = createStyleJSON({
            sources: {
                base: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            },
            layers: [{
                id: 'layerId0',
                type: 'circle',
                source: 'base'
            }, {
                id: 'layerId1',
                type: 'circle',
                source: 'base'
            }]
        });

        const nextState = createStyleJSON();
        const style = new Style(getStubMap());
        style.loadJSON(initialState);

        await style.once('style.load');
        const didChange = style.setState(nextState, {
            transformStyle: (prevStyle, nextStyle) => ({
                ...nextStyle,
                sources: {
                    ...nextStyle.sources,
                    base: prevStyle.sources.base
                },
                layers: [
                    ...nextStyle.layers,
                    prevStyle.layers[0]
                ]
            })
        });

        expect(didChange).toBeTruthy();
        expect('base' in style.stylesheet.sources).toBeTruthy();
        expect(style.stylesheet.layers[0].id).toBe(initialState.layers[0].id);
        expect(style.stylesheet.layers).toHaveLength(1);
    });

    test('Style#setState skips validateStyle when validate false', async () => {
        const style = new Style(getStubMap());
        const styleSpec = createStyleJSON();
        style.loadJSON(styleSpec);

        await style.once('style.load');

        style.addSource('abc', createSource());
        const nextState = {...styleSpec};
        nextState.sources['def'] = {type: 'geojson'} as GeoJSONSourceSpecification;

        const didChange = style.setState(nextState, {validate: false});

        expect(didChange).toBeTruthy();
    });
});

describe('Style#addSource', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.addSource('source-id', createSource())).toThrow(/load/i);
    });

    test('throw if missing source type', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        await style.once('style.load');

        expect(() => style.addSource('source-id', source)).toThrow(/type/i);
    });

    test('fires "data" event', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        const source = createSource();
        const dataPromise = style.once('data');
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update({} as EvaluationParameters);
        });
        await dataPromise;
    });

    test('throws on duplicates', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        const source = createSource();
        await style.once('style.load');
        style.addSource('source-id', source);
        expect(() => {
            style.addSource('source-id', source);
        }).toThrow(/Source "source-id" already exists./);
    });

    test('sets up source event forwarding', async () => {
        const promisesResolve = {} as any;
        const promises = [
            new Promise((resolve) => { promisesResolve.error = resolve; }),
            new Promise((resolve) => { promisesResolve.metadata = resolve; }),
            new Promise((resolve) => { promisesResolve.content = resolve; }),
            new Promise((resolve) => { promisesResolve.other = resolve; }),
        ];

        const style = createStyle();
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        await style.once('style.load');
        style.on('error', () => {
            promisesResolve.error();
        });
        style.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                promisesResolve.metadata();
            } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                promisesResolve.content();
            } else {
                promisesResolve.other();
            }
        });

        style.addSource('source-id', source); // fires data twice
        style.sourceCaches['source-id'].fire(new Event('error'));
        style.sourceCaches['source-id'].fire(new Event('data'));

        await expect(Promise.all(promises)).resolves.toBeDefined();
    });
});

describe('Style#removeSource', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.removeSource('source-id')).toThrow(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        const dataPromise = style.once('data');
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update({} as EvaluationParameters);
        });
        await dataPromise;
    });

    test('clears tiles', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        await style.once('style.load');
        const sourceCache = style.sourceCaches['source-id'];
        vi.spyOn(sourceCache, 'clearTiles');
        style.removeSource('source-id');
        expect(sourceCache.clearTiles).toHaveBeenCalledTimes(1);
    });

    test('throws on non-existence', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        await style.once('style.load');
        expect(() => {
            style.removeSource('source-id');
        }).toThrow(/There is no source with this ID/);
    });

    async function createStyleAndLoad(): Promise<Style> {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            'sources': {
                'mapLibre-source': createGeoJSONSource()
            },
            'layers': [{
                'id': 'mapLibre-layer',
                'type': 'circle',
                'source': 'mapLibre-source',
                'source-layer': 'whatever'
            }]
        }));
        await style.once('style.load');
        style.update(1 as any as EvaluationParameters);
        return style;
    }

    test('throws if source is in use', async () => {
        const style = await createStyleAndLoad();
        const promise =  style.once('error');
        style.removeSource('mapLibre-source');
        const event = await promise;
        expect(event.error.message.includes('"mapLibre-source"')).toBeTruthy();
        expect(event.error.message.includes('"mapLibre-layer"')).toBeTruthy();
    });

    test('does not throw if source is not in use', async () => {
        const style = await createStyleAndLoad();
        const promise = style.once('error');
        style.removeLayer('mapLibre-layer');
        style.removeSource('mapLibre-source');
        await expect(Promise.any([promise, sleep(100)])).resolves.toBeUndefined();
    });

    test('tears down source event forwarding', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();

        await style.once('style.load');
        style.addSource('source-id', source);
        const sourceCache = style.sourceCaches['source-id'];

        style.removeSource('source-id');

        // Suppress error reporting
        sourceCache.on('error', () => {});

        style.on('data', () => { expect(false).toBeTruthy(); });
        style.on('error', () => { expect(false).toBeTruthy(); });
        sourceCache.fire(new Event('data'));
        sourceCache.fire(new Event('error'));
    });
});

describe('Style#addSprite', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.addSprite('test', 'https://example.com/sprite')).toThrow(/load/i);
    });

    test('validates input and fires an error if there\'s already an existing sprite with the same id', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        await style.once('style.load');
        const promise = style.once('error');
        style.addSprite('test', 'https://example.com/sprite');
        style.addSprite('test', 'https://example.com/sprite2');
        const error = await promise;
        expect(error.error.message).toMatch(/sprite: all the sprites' ids must be unique, but test is duplicated/);
    });

    test('adds a new sprite to the stylesheet when there\'s no sprite at all', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        await style.once('style.load');
        style.addSprite('test', 'https://example.com/sprite');
        expect(style.stylesheet.sprite).toStrictEqual([{id: 'test', url: 'https://example.com/sprite'}]);
    });

    test('adds a new sprite to the stylesheet when there\'s a stringy sprite existing', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sprite: 'https://example.com/default'}));
        await style.once('style.load');
        style.addSprite('test', 'https://example.com/sprite');
        expect(style.stylesheet.sprite).toStrictEqual([
            {id: 'default', url: 'https://example.com/default'},
            {id: 'test', url: 'https://example.com/sprite'}
        ]);
    });

    test('adds a new sprite to the stylesheet when there\'s an array-sprite existing', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sprite: [{id: 'default', url: 'https://example.com/default'}]}));
        await style.once('style.load');
        style.addSprite('test', 'https://example.com/sprite');
        expect(style.stylesheet.sprite).toStrictEqual([
            {id: 'default', url: 'https://example.com/default'},
            {id: 'test', url: 'https://example.com/sprite'}
        ]);
    });
});

describe('Style#removeSprite', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.removeSprite('test')).toThrow(/load/i);
    });

    test('fires an error when trying to delete an non-existing sprite (sprite: undefined)', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', (error) => {
                expect(error.error.message).toMatch(/Sprite \"test\" doesn't exists on this map./);
                done();
            });

            style.removeSprite('test');
        });
    }));

    test('fires an error when trying to delete an non-existing sprite (sprite: single url)', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sprite: 'https://example.com/sprite'}));
        style.on('style.load', () => {
            style.on('error', (error) => {
                expect(error.error.message).toMatch(/Sprite \"test\" doesn't exists on this map./);
                done();
            });

            style.removeSprite('test');
        });
    }));

    test('fires an error when trying to delete an non-existing sprite (sprite: array)', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sprite: [{id: 'default', url: 'https://example.com/sprite'}]}));
        style.on('style.load', () => {
            style.on('error', (error) => {
                expect(error.error.message).toMatch(/Sprite \"test\" doesn't exists on this map./);
                done();
            });

            style.removeSprite('test');
        });
    }));

    test('removes the sprite when it\'s a single URL', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sprite: 'https://example.com/test'}));
        await style.once('style.load');
        style.removeSprite('default');
        expect(style.stylesheet.sprite).toBeUndefined();
    });

    test('removes the sprite when it\'s an array', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON([{id: 'default', url: 'https://example.com/sprite'}]));
        await style.once('style.load');
        style.removeSprite('default');
        expect(style.stylesheet.sprite).toBeUndefined();
    });
});

describe('Style#setGeoJSONSourceData', () => {
    const geoJSON = {type: 'FeatureCollection', features: []} as GeoJSON.GeoJSON;

    test('throws before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/load/i);
    });

    test('throws on non-existence', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        await style.once('style.load');
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/There is no source with this ID/);
    });
});

describe('Style#addLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.addLayer({id: 'background', type: 'background'})).toThrow(/load/i);
    });

    test('sets up layer event forwarding', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        style.on('error', (e) => {
            expect(e.layer).toEqual({id: 'background'});
            expect(e.mapLibre).toBeTruthy();
            done();
        });

        style.on('style.load', () => {
            style.addLayer({
                id: 'background',
                type: 'background'
            });
            style._layers.background.fire(new Event('error', {mapLibre: true}));
        });
    }));

    test('throws on non-existant vector source layer', () => new Promise<void>(done => {
        const style = createStyle();
        style.loadJSON(createStyleJSON({
            sources: {
                // At least one source must be added to trigger the load event
                dummy: {type: 'vector', tiles: []}
            }
        }));

        style.on('style.load', () => {
            const source = createSource();
            source['vector_layers'] = [{id: 'green'}];
            style.addSource('-source-id-', source);
            style.addLayer({
                'id': '-layer-id-',
                'type': 'circle',
                'source': '-source-id-',
                'source-layer': '-source-layer-'
            });
        });

        style.on('error', (event) => {
            const err = event.error;

            expect(err).toBeTruthy();
            expect(err.toString().indexOf('-source-layer-') !== -1).toBeTruthy();
            expect(err.toString().indexOf('-source-id-') !== -1).toBeTruthy();
            expect(err.toString().indexOf('-layer-id-') !== -1).toBeTruthy();

            done();
        });
    }));

    test('emits error on invalid layer', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.getLayer('background')).toBeFalsy();
                done();
            });
            style.addLayer({
                id: 'background',
                type: 'background',
                paint: {
                    'background-opacity': 5
                }
            });
        });
    }));

    test('#4040 does not mutate source property when provided inline', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        await style.once('style.load');
        const source = {
            'type': 'geojson',
            'data': {
                'type': 'Point',
                'coordinates': [0, 0]
            }
        };
        const layer = {id: 'inline-source-layer', type: 'circle', source} as any as LayerSpecification;
        style.addLayer(layer);
        expect((layer as any).source).toEqual(source);
    });

    test('reloads source', () => new Promise<void>(done => {
        const style = createStyle();
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapLibre': {
                    'type': 'vector',
                    'tiles': []
                }
            }
        }));
        const layer = {
            'id': 'symbol',
            'type': 'symbol',
            'source': 'mapLibre',
            'source-layer': 'libremap',
            'filter': ['==', 'id', 0]
        } as LayerSpecification;

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapLibre'].reload = () => { done(); };
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });
    }));

    test('#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it', () => new Promise<void>((done) => {
        const style = createStyle();
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapLibre': {
                    'type': 'vector',
                    'tiles': []
                }
            },
            layers: [{
                'id': 'my-layer',
                'type': 'symbol',
                'source': 'mapLibre',
                'source-layer': 'libremap',
                'filter': ['==', 'id', 0]
            }]
        }));

        const layer = {
            'id': 'my-layer',
            'type': 'symbol',
            'source': 'mapLibre',
            'source-layer': 'libremap'
        }as LayerSpecification;

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapLibre'].reload = () => { done(); };
                style.sourceCaches['mapLibre'].clearTiles =  () => { throw new Error('test failed'); };
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });

    }));

    test('clears source (instead of reloading) if adding this layer with a different type, immediately after removing it', () => new Promise<void>((done) => {
        const style = createStyle();
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapLibre': {
                    'type': 'vector',
                    'tiles': []
                }
            },
            layers: [{
                'id': 'my-layer',
                'type': 'symbol',
                'source': 'mapLibre',
                'source-layer': 'libremap',
                'filter': ['==', 'id', 0]
            }]
        }));

        const layer = {
            'id': 'my-layer',
            'type': 'circle',
            'source': 'mapLibre',
            'source-layer': 'libremap'
        }as LayerSpecification;
        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapLibre'].reload =  () => { throw new Error('test failed'); };
                style.sourceCaches['mapLibre'].clearTiles = () => { done(); };
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });

    }));

    test('fires "data" event', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        const dataPromise = style.once('data');

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update({} as EvaluationParameters);
        });
        await dataPromise;
    });

    test('emits error on duplicates', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        style.on('error', (e) => {
            expect(e.error.message).toMatch(/already exists/);
            done();
        });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.addLayer(layer);
        });
    }));

    test('adds to the end by default', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'} as LayerSpecification;

        await style.once('style.load');
        style.addLayer(layer);
        expect(style._order).toEqual(['a', 'b', 'c']);
    });

    test('adds before the given layer', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'} as LayerSpecification;

        await style.once('style.load');
        style.addLayer(layer, 'a');
        expect(style._order).toEqual(['c', 'a', 'b']);
    });

    test('fire error if before layer does not exist', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'} as LayerSpecification;

        style.on('style.load', () => {
            style.on('error', (error) => {
                expect(error.error.message).toMatch(/Cannot add layer "c" before non-existing layer "z"./);
                done();
            });
            style.addLayer(layer, 'z');
        });
    }));

    test('fires an error on non-existant source layer', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(extend(createStyleJSON(), {
            sources: {
                dummy: {
                    type: 'geojson',
                    data: {type: 'FeatureCollection', features: []}
                }
            }
        }));

        const layer = {
            id: 'dummy',
            type: 'fill',
            source: 'dummy',
            'source-layer': 'dummy'
        }as LayerSpecification;

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist on source/);
                done();
            });
            style.addLayer(layer);
        });

    }));
});

describe('Style#removeLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.removeLayer('background')).toThrow(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        const dataPromise = style.once('data');

        style.on('style.load', () => {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update({} as EvaluationParameters);
        });

        await dataPromise;
    });

    test('tears down layer event forwarding', () => new Promise<void>((done) => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', () => {
            throw new Error('test failed');
        });

        style.on('style.load', () => {
            const layer = style._layers.background;
            style.removeLayer('background');

            // Bind a listener to prevent fallback Evented error reporting.
            layer.on('error', () => {});

            layer.fire(new Event('error', {mapLibre: true}));
            done();
        });
    }));

    test('fires an error on non-existence', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        const promise = style.once('error');
        style.removeLayer('background');
        const {error} = await promise;
        expect(error.message).toMatch(/Cannot remove non-existing layer "background"./);
    });

    test('removes from the order', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));

        await style.once('style.load');
        style.removeLayer('a');
        expect(style._order).toEqual(['b']);
    });

    test('does not remove dereffed layers', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                ref: 'a'
            }]
        }));

        await style.once('style.load');
        style.removeLayer('a');
        expect(style.getLayer('a')).toBeUndefined();
        expect(style.getLayer('b')).toBeDefined();
    });
});

describe('Style#moveLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.moveLayer('background')).toThrow(/load/i);
    });

    test('fires "data" event', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        const dataPromise = style.once('data');
        style.on('style.load', () => {
            style.addLayer(layer);
            style.moveLayer('background');
            style.update({} as EvaluationParameters);
        });
        await dataPromise;
    });

    test('fires an error on non-existence', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        const promise = style.once('error');
        style.moveLayer('background');
        const {error} = await promise;
        expect(error.message).toMatch(/does not exist in the map\'s style and cannot be moved/);
    });

    test('changes the order', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        await style.once('style.load');
        style.moveLayer('a', 'c');
        expect(style._order).toEqual(['b', 'a', 'c']);
    });

    test('moves to existing location', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        await style.once('style.load');
        style.moveLayer('b', 'b');
        expect(style._order).toEqual(['a', 'b', 'c']);
    });
});

describe('Style#setPaintProperty', () => {
    test('#4738 postpones source reload until layers have been broadcast to workers', () => new Promise<void>(done => {
        const style = new Style(getStubMap());
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'geojson': {
                    'type': 'geojson',
                    'data': {'type': 'FeatureCollection', 'features': []}
                }
            },
            'layers': [
                {
                    'id': 'circle',
                    'type': 'circle',
                    'source': 'geojson'
                }
            ]
        }));

        const tr = new MercatorTransform();
        tr.resize(512, 512);

        style.once('style.load', () => {
            style.update(tr.zoom as any as EvaluationParameters);
            const sourceCache = style.sourceCaches['geojson'];
            const source = style.getSource('geojson');

            let begun = false;
            let styleUpdateCalled = false;

            (source as any).on('data', (e) => setTimeout(() => {
                if (!begun) {
                    begun = true;
                    vi.spyOn(sourceCache, 'reload').mockImplementation(() => {
                        expect(styleUpdateCalled).toBeTruthy();
                        done();
                    });

                    (source as any).setData({'type': 'FeatureCollection', 'features': []});
                    style.setPaintProperty('circle', 'circle-color', {type: 'identity', property: 'foo'});
                }

                if (begun && e.sourceDataType === 'content') {
                    // setData() worker-side work is complete; simulate an
                    // animation frame a few ms later, so that this test can
                    // confirm that SourceCache#reload() isn't called until
                    // after the next Style#update()
                    setTimeout(() => {
                        styleUpdateCalled = true;
                        style.update({} as EvaluationParameters);
                    }, 50);
                }
            }));
        });
    }));

    test('#5802 clones the input', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [
                {
                    'id': 'background',
                    'type': 'background'
                }
            ]
        });

        await style.once('style.load');
        const value = {stops: [[0, 'red'], [10, 'blue']]};
        style.setPaintProperty('background', 'background-color', value);
        expect(style.getPaintProperty('background', 'background-color')).not.toBe(value);
        expect(style._changed).toBeTruthy();

        style.update({} as EvaluationParameters);
        expect(style._changed).toBeFalsy();

        value.stops[0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        expect(style._changed).toBeTruthy();
    });

    test('respects validate option', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [
                {
                    'id': 'background',
                    'type': 'background'
                }
            ]
        });

        await style.once('style.load');
        const backgroundLayer = style.getLayer('background');
        const validate = vi.spyOn(backgroundLayer, '_validate');

        style.setPaintProperty('background', 'background-color', 'notacolor', {validate: false});
        expect(validate.mock.calls[0][4]).toEqual({validate: false});
        expect(mockConsoleError).not.toHaveBeenCalled();

        expect(style._changed).toBeTruthy();
        style.update({} as EvaluationParameters);

        style.setPaintProperty('background', 'background-color', 'alsonotacolor');
        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        expect(validate.mock.calls[1][4]).toEqual({});
    });
});

describe('Style#getPaintProperty', () => {
    test('#5802 clones the output', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [
                {
                    'id': 'background',
                    'type': 'background'
                }
            ]
        });

        await style.once('style.load');
        style.setPaintProperty('background', 'background-color', {stops: [[0, 'red'], [10, 'blue']]});
        style.update({} as EvaluationParameters);
        expect(style._changed).toBeFalsy();

        const value = style.getPaintProperty('background', 'background-color');
        value['stops'][0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        expect(style._changed).toBeTruthy();
    });
});

describe('Style#setLayoutProperty', () => {
    test('#5802 clones the input', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'geojson': {
                    'type': 'geojson',
                    'data': {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                }
            },
            'layers': [
                {
                    'id': 'line',
                    'type': 'line',
                    'source': 'geojson'
                }
            ]
        });

        await style.once('style.load');
        const value = {stops: [[0, 'butt'], [10, 'round']]};
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style.getLayoutProperty('line', 'line-cap')).not.toBe(value);
        expect(style._changed).toBeTruthy();

        style.update({} as EvaluationParameters);
        expect(style._changed).toBeFalsy();

        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style._changed).toBeTruthy();
    });

    test('respects validate option', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'geojson': {
                    'type': 'geojson',
                    'data': {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                }
            },
            'layers': [
                {
                    'id': 'line',
                    'type': 'line',
                    'source': 'geojson'
                }
            ]
        });

        await style.once('style.load');
        const lineLayer = style.getLayer('line');
        const validate = vi.spyOn(lineLayer, '_validate');

        style.setLayoutProperty('line', 'line-cap', 'invalidcap', {validate: false});
        expect(validate.mock.calls[0][4]).toEqual({validate: false});
        expect(mockConsoleError).not.toHaveBeenCalled();
        expect(style._changed).toBeTruthy();
        style.update({} as EvaluationParameters);

        style.setLayoutProperty('line', 'line-cap', 'differentinvalidcap');
        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        expect(validate.mock.calls[1][4]).toEqual({});
    });
});

describe('Style#getLayoutProperty', () => {
    test('#5802 clones the output', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'geojson': {
                    'type': 'geojson',
                    'data': {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                }
            },
            'layers': [
                {
                    'id': 'line',
                    'type': 'line',
                    'source': 'geojson'
                }
            ]
        });

        await style.once('style.load');
        style.setLayoutProperty('line', 'line-cap', {stops: [[0, 'butt'], [10, 'round']]});
        style.update({} as EvaluationParameters);
        expect(style._changed).toBeFalsy();

        const value = style.getLayoutProperty('line', 'line-cap');
        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        expect(style._changed).toBeTruthy();
    });
});

describe('Style#setFilter', () => {
    test('throws if style is not loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setFilter('symbol', ['==', 'id', 1])).toThrow(/load/i);
    });

    function createStyle() {
        const style = new Style(getStubMap());
        style.loadJSON({
            version: 8,
            sources: {
                geojson: createGeoJSONSource()
            },
            layers: [
                {id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0]}
            ]
        });
        return style;
    }

    test('sets filter', () => new Promise<void>(done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = (key, value) => {
                expect(key).toBe(MessageType.updateLayers);
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toEqual(['==', 'id', 1]);
                done();
                return Promise.resolve({} as any);
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 1]);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    }));

    test('gets a clone of the filter', async () => {
        const style = createStyle();

        await style.once('style.load');
        const filter1 = ['==', 'id', 1] as FilterSpecification;
        style.setFilter('symbol', filter1);
        const filter2 = style.getFilter('symbol');
        const filter3 = style.getLayer('symbol').filter;

        expect(filter1).not.toBe(filter2);
        expect(filter1).not.toBe(filter3);
        expect(filter2).not.toBe(filter3);
    });

    test('sets again mutated filter', () => new Promise<void>(done => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter = ['==', 'id', 1] as FilterSpecification;
            style.setFilter('symbol', filter);
            style.update({} as EvaluationParameters); // flush pending operations

            style.dispatcher.broadcast = (key, value) => {
                expect(key).toBe(MessageType.updateLayers);
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toEqual(['==', 'id', 2]);
                done();
                return Promise.resolve({} as any);
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    }));

    test('unsets filter', async () => {
        const style = createStyle();
        await style.once('style.load');
        style.setFilter('symbol', null);
        expect(style.getLayer('symbol').serialize()['filter']).toBeUndefined();
    });

    test('emits if invalid', async () => {
        const style = createStyle();
        await style.once('style.load');
        const promise = style.once('error');
        style.setFilter('symbol', ['==', '$type', 1]);
        await promise;
        expect(style.getLayer('symbol').serialize()['filter']).toEqual(['==', 'id', 0]);
    });

    test('fires an error if layer not found', async () => {
        const style = createStyle();

        await style.once('style.load');
        const promise = style.once('error');
        style.setFilter('non-existant', ['==', 'id', 1]);
        const {error} = await promise;
        expect(error.message).toMatch(/Cannot filter non-existing layer "non-existant"./);
    });

    test('validates filter by default', async () => {
        const style = createStyle();
        await style.once('style.load');
        style.setFilter('symbol', 'notafilter' as any as FilterSpecification);
        expect(style.getFilter('symbol')).toEqual(['==', 'id', 0]);
        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        style.update({} as EvaluationParameters); // trigger dispatcher broadcast
    });

    test('respects validate option', () => new Promise<void>(done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = (key, value) => {
                expect(key).toBe(MessageType.updateLayers);
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toBe('notafilter');
                done();
                return Promise.resolve({} as any);
            };

            style.setFilter('symbol', 'notafilter' as any as FilterSpecification, {validate: false});
            expect(style.getFilter('symbol')).toBe('notafilter');
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    }));
});

describe('Style#setLayerZoomRange', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setLayerZoomRange('symbol', 5, 12)).toThrow(/load/i);
    });

    function createStyle() {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'geojson': createGeoJSONSource()
            },
            'layers': [{
                'id': 'symbol',
                'type': 'symbol',
                'source': 'geojson'
            }]
        });
        return style;
    }

    test('sets zoom range', () => new Promise<void>(done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = (key, value) => {
                expect(key).toBe(MessageType.updateLayers);
                expect(value['layers'].map((layer) => { return layer.id; })).toEqual(['symbol']);
                done();
                return Promise.resolve({} as any);
            };
            style.setLayerZoomRange('symbol', 5, 12);
            expect(style.getLayer('symbol').minzoom).toBe(5);
            expect(style.getLayer('symbol').maxzoom).toBe(12);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    }));

    test('fires an error if layer not found', async () => {
        const style = createStyle();
        await style.once('style.load');
        const promise = style.once('error');
        style.setLayerZoomRange('non-existant', 5, 12);
        const {error} = await promise;
        expect(error.message).toMatch(/Cannot set the zoom range of non-existing layer "non-existant"./);
    });

    test('does not reload raster source', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'raster': {
                    type: 'raster',
                    tiles: ['http://tiles.server']
                }
            },
            'layers': [{
                'id': 'raster',
                'type': 'raster',
                'source': 'raster'
            }]
        });

        await style.once('style.load');
        vi.spyOn(style, '_reloadSource');

        style.setLayerZoomRange('raster', 5, 12);
        style.update(0 as any as EvaluationParameters);
        expect(style._reloadSource).not.toHaveBeenCalled();
    });
});

describe('Style#getLayersOrder', () => {
    test('returns ids of layers in the correct order', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'raster': {
                    type: 'raster',
                    tiles: ['http://tiles.server']
                }
            },
            'layers': [{
                'id': 'raster',
                'type': 'raster',
                'source': 'raster'
            }]
        });

        await style.once('style.load');
        style.addLayer({
            id: 'custom',
            type: 'custom',
            render() {}
        }, 'raster');
        expect(style.getLayersOrder()).toEqual(['custom', 'raster']);
    });
});

describe('Style#queryRenderedFeatures', () => {

    let style: Style;
    let transform: MercatorTransform;

    beforeEach(() => new Promise<void>(callback => {
        style = new Style(getStubMap());
        transform = new MercatorTransform();
        transform.resize(512, 512);
        function queryMapLibreFeatures(layers, serializedLayers, getFeatureState, queryGeom, cameraQueryGeom, scale, params) {
            const features = {
                'land': [{
                    type: 'Feature',
                    layer: style._layers.land.serialize(),
                    geometry: {
                        type: 'Polygon'
                    }
                }, {
                    type: 'Feature',
                    layer: style._layers.land.serialize(),
                    geometry: {
                        type: 'Point'
                    }
                }],
                'landref': [{
                    type: 'Feature',
                    layer: style._layers.landref.serialize(),
                    geometry: {
                        type: 'Line'
                    }
                }]
            };

            // format result to shape of tile.queryRenderedFeatures result
            for (const layer in features) {
                features[layer] = features[layer].map((feature, featureIndex) =>
                    ({feature, featureIndex}));
            }

            if (params.layers) {
                for (const l in features) {
                    if (!params.layers.has(l)) {
                        delete features[l];
                    }
                }
            }

            return features;
        }

        style.loadJSON({
            'version': 8,
            'sources': {
                'mapLibre': {
                    'type': 'geojson',
                    'data': {type: 'FeatureCollection', features: []}
                },
                'other': {
                    'type': 'geojson',
                    'data': {type: 'FeatureCollection', features: []}
                }
            },
            'layers': [{
                'id': 'land',
                'type': 'line',
                'source': 'mapLibre',
                'source-layer': 'water',
                'layout': {
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': 'red'
                },
                'metadata': {
                    'something': 'else'
                }
            }, {
                'id': 'landref',
                'ref': 'land',
                'paint': {
                    'line-color': 'blue'
                }
            } as any as LayerSpecification, {
                'id': 'land--other',
                'type': 'line',
                'source': 'other',
                'source-layer': 'water',
                'layout': {
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': 'red'
                },
                'metadata': {
                    'something': 'else'
                }
            }]
        });

        style.on('style.load', () => {
            style.sourceCaches.mapLibre.tilesIn = () => {
                return [{
                    tile: {queryRenderedFeatures: queryMapLibreFeatures} as unknown as Tile,
                    tileID: new OverscaledTileID(0, 0, 0, 0, 0),
                    queryGeometry: [],
                    scale: 1,
                    cameraQueryGeometry: []
                }];
            };
            style.sourceCaches.other.tilesIn = () => {
                return [];
            };

            style.sourceCaches.mapLibre.transform = transform;
            style.sourceCaches.other.transform = transform;

            style.update(0 as any as EvaluationParameters);
            style._updateSources(transform);
            callback();
        });
    }));

    afterEach(() => {
        style = undefined;
        transform = undefined;
    });

    test('returns feature type', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {}, transform);
        expect(results[0].geometry.type).toBe('Line');
    });

    test('filters by `layers` option', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: ['land']}, transform);
        expect(results).toHaveLength(2);
    });

    test('filters by `layers` option as a Set', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: new Set(['land'])}, transform);
        expect(results).toHaveLength(2);
    });

    test('checks type of `layers` option', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error'] && event['error'].message.includes('parameters.layers must be an Array')) {
                errors++;
            }
            return style;
        });
        style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: 'string' as any}, transform);
        expect(errors).toBe(1);
    });

    test('includes layout properties', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {}, transform);
        const layout = results[0].layer.layout;
        expect(layout['line-cap']).toBe('round');
    });

    test('includes paint properties', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {}, transform);
        expect(results[2].layer.paint['line-color']).toBe('red');
    });

    test('includes metadata', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {}, transform);

        const layer = results[1].layer;
        expect((layer.metadata as any).something).toBe('else');

    });

    test('include multiple layers', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: new Set(['land', 'landref'])}, transform);
        expect(results).toHaveLength(3);
    });

    test('does not query sources not implicated by `layers` parameter', () => {
        style.sourceCaches.mapLibre.map.queryRenderedFeatures = vi.fn();
        style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: ['land--other']}, transform);
        expect(style.sourceCaches.mapLibre.map.queryRenderedFeatures).not.toHaveBeenCalled();
    });

    test('fires an error if layer included in params does not exist on the style', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error'] && event['error'].message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            return style;
        });
        const results = style.queryRenderedFeatures([{x: 0, y: 0} as Point], {layers: ['merp']}, transform);
        expect(errors).toBe(1);
        expect(results).toHaveLength(0);
    });
});

describe('Style defers  ...', () => {
    test('... expensive methods', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            'sources': {
                'streets': createGeoJSONSource(),
                'terrain': createGeoJSONSource()
            }
        }));

        await style.once('style.load');
        style.update({} as EvaluationParameters);

        // spies to track deferred methods
        const mockStyleFire = vi.spyOn(style, 'fire');
        vi.spyOn(style, '_reloadSource');
        vi.spyOn(style, '_updateWorkerLayers');

        style.addLayer({id: 'first', type: 'symbol', source: 'streets'});
        style.addLayer({id: 'second', type: 'symbol', source: 'streets'});
        style.addLayer({id: 'third', type: 'symbol', source: 'terrain'});

        style.setPaintProperty('first', 'text-color', 'black');
        style.setPaintProperty('first', 'text-halo-color', 'white');

        expect(style.fire).not.toHaveBeenCalled();
        expect(style._reloadSource).not.toHaveBeenCalled();
        expect(style._updateWorkerLayers).not.toHaveBeenCalled();

        style.update({} as EvaluationParameters);

        expect(mockStyleFire.mock.calls[0][0]['type']).toBe('data');

        // called per source
        expect(style._reloadSource).toHaveBeenCalledTimes(2);
        expect(style._reloadSource).toHaveBeenCalledWith('streets');
        expect(style._reloadSource).toHaveBeenCalledWith('terrain');

        // called once
        expect(style._updateWorkerLayers).toHaveBeenCalledTimes(1);
    });
});

describe('Style#query*Features', () => {

    // These tests only cover filter validation. Most tests for these methods
    // live in the integration tests.

    let style: Style;
    let onError;
    let transform;

    beforeEach(() => new Promise<void>(callback => {
        transform = new MercatorTransform();
        transform.resize(100, 100);
        style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {
                'geojson': createGeoJSONSource()
            },
            'layers': [{
                'id': 'symbol',
                'type': 'symbol',
                'source': 'geojson'
            }]
        });

        onError = vi.fn();

        style.on('error', onError);
        style.on('style.load', () => {
            callback();
        });
    }));

    test('querySourceFeatures emits an error on incorrect filter', () => {
        expect(style.querySourceFeatures([10, 100] as any, {filter: 7} as any)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/querySourceFeatures\.filter/);
    });

    test('queryRenderedFeatures emits an error on incorrect filter', () => {
        expect(style.queryRenderedFeatures([{x: 0, y: 0} as Point], {filter: 7 as any}, transform)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/queryRenderedFeatures\.filter/);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error']) {
                errors++;
            }
            return style;
        });
        style.queryRenderedFeatures([{x: 0, y: 0} as Point], {filter: 'invalidFilter' as any, validate: false}, transform);
        expect(errors).toBe(0);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        vi.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error']) errors++;
            return style;
        });
        style.querySourceFeatures([{x: 0, y: 0}] as any, {filter: 'invalidFilter' as any, validate: false});
        expect(errors).toBe(0);
    });

    test('serialized layers should be correctly updated after adding/removing layers', () => {

        let serializedStyle = style.serialize();
        expect(serializedStyle.layers).toHaveLength(1);
        expect(serializedStyle.layers[0].id).toBe('symbol');

        const layer = {
            id: 'background',
            type: 'background'
        } as LayerSpecification;
        style.addLayer(layer);

        // serialize again
        serializedStyle = style.serialize();
        expect(serializedStyle.layers).toHaveLength(2);
        expect(serializedStyle.layers[1].id).toBe('background');

        // remove and serialize
        style.removeLayer('background');
        serializedStyle = style.serialize();
        expect(serializedStyle.layers).toHaveLength(1);

    });
});

describe('Style#hasTransitions', () => {
    test('returns false when the style is loading', () => {
        const style = new Style(getStubMap());
        expect(style.hasTransitions()).toBe(false);
    });

    test('returns true when a property is transitioning', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [{
                'id': 'background',
                'type': 'background'
            }]
        });

        await style.once('style.load');
        style.setPaintProperty('background', 'background-color', 'blue');
        style.update({transition: {duration: 300, delay: 0}} as EvaluationParameters);
        expect(style.hasTransitions()).toBe(true);
    });

    test('returns false when a property is not transitioning', async () => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [{
                'id': 'background',
                'type': 'background'
            }]
        });

        await style.once('style.load');
        style.setPaintProperty('background', 'background-color', 'blue');
        style.update({transition: {duration: 0, delay: 0}} as EvaluationParameters);
        expect(style.hasTransitions()).toBe(false);
    });
});

describe('Style#serialize', () => {
    test('include terrain property when map has 3D terrain', async () => {
        const terrain = {
            source: 'terrainSource',
            exaggeration: 1
        };
        const styleJson = createStyleJSON({terrain});
        const style = new Style(getStubMap());
        style.loadJSON(styleJson);

        await style.once('style.load');
        expect(style.serialize().terrain).toBe(terrain);
    });

    test('do not include terrain property when map does not have 3D terrain', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        expect(style.serialize().terrain).toBeUndefined();
    });

    test('include projection property when projection is defined in the style', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            projection: {
                type: 'globe'
            }
        }));

        await style.once('style.load');
        expect(style.serialize().projection).toBeDefined();
        expect(style.serialize().projection.type).toBe('globe');
    });

    test('include projection property when projection is set', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        style.setProjection({type: 'globe'});

        expect(style.serialize().projection).toBeDefined();
        expect(style.serialize().projection.type).toBe('globe');
    });

    test('include sky property when map has sky', async () => {
        const sky: SkySpecification = {
            'horizon-fog-blend': 0.5,
            'fog-color': '#fff'
        };
        const styleJson = createStyleJSON({sky});
        const style = new Style(getStubMap());
        style.loadJSON(styleJson);

        await style.once('style.load');
        expect(style.serialize().sky).toBe(sky);
    });

    test('include sky property when sky is set', async () => {
        const sky = {
            'atmosphere-blend': 0.5,
        };
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        style.setSky(sky);

        expect(style.serialize().sky).toBeDefined();
        expect(style.serialize().sky).toBe(sky);
        expect(style.serialize().sky).toStrictEqual(sky);
    });

    test('do not include sky property when map does not have sky', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        expect(style.serialize().sky).toBeUndefined();
    });

    test('sky should be undefined when map does not have sky', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        expect(style.getSky()).toBeUndefined();
    });

    test('sky should be defined even after setting it to undefined and back', async () => {
        const sky: SkySpecification = {
            'horizon-fog-blend': 0.5,
            'fog-color': '#fff'
        };
        const styleJson = createStyleJSON({sky});
        const style = new Style(getStubMap());
        style.loadJSON(styleJson);

        await style.once('style.load');
        style.setSky(undefined);
        expect(style.serialize().sky).toBeUndefined();
        style.setSky(sky);
        expect(style.serialize().sky).toBeDefined();
        style.setSky(undefined);
        expect(style.serialize().sky).toBeUndefined();
    });

    test('do not include sky property after removing sky from the map', async () => {
        const sky: SkySpecification = {
            'horizon-fog-blend': 0.5,
            'fog-color': '#fff'
        };
        const styleJson = createStyleJSON({sky});
        const style = new Style(getStubMap());
        style.loadJSON(styleJson);

        await style.once('style.load');
        style.setSky(undefined);
        expect(style.serialize().sky).toBeUndefined();
    });

    test('include sky property when setting it after map loads', async () => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        await style.once('style.load');
        style.setSky({
            'horizon-fog-blend': 0.5,
            'fog-color': '#fff'
        });
        expect(style.serialize().sky).toBeDefined();
    });

    test('update sky properties after setting the sky on initial load', async () => {
        const sky: SkySpecification = {
            'fog-color': '#FF0000'
        };
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({sky, transition: {duration: 0, delay: 0}}));

        await style.once('style.load');
        style.setSky({
            'fog-color': '#00FF00'
        });
        style.update({transition: {duration: 0, delay: 0}} as EvaluationParameters);
        expect(style.sky.properties.get('fog-color').g).toBe(1);
        expect(style.sky.properties.get('fog-color').r).toBe(0);
    });
});
