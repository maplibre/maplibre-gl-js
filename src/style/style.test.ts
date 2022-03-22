import Style from './style';
import SourceCache from '../source/source_cache';
import StyleLayer from './style_layer';
import Transform from '../geo/transform';
import {extend} from '../util/util';
import {RequestManager} from '../util/request_manager';
import {Event, Evented} from '../util/evented';
import {
    setRTLTextPlugin,
    clearRTLTextPlugin,
    evented as rtlTextPluginEvented
} from '../source/rtl_text_plugin';
import browser from '../util/browser';
import {OverscaledTileID} from '../source/tile_id';
import {fakeXhr, fakeServer} from 'nise';
import {WorkerGlobalScopeInterface} from '../util/web_worker';
import EvaluationParameters from './evaluation_parameters';
import {LayerSpecification, GeoJSONSourceSpecification, FilterSpecification, SourceSpecification} from '../style-spec/types.g';
import {SourceClass} from '../source/source';
import GeoJSONSource from '../source/geojson_source';

function createStyleJSON(properties?) {
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

function createGeoJSONSource() {
    return {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': []
        }
    };
}

class StubMap extends Evented {
    style: Style;
    transform: Transform;
    private _requestManager: RequestManager;

    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
    }

    _getMapId() {
        return 1;
    }

    getPixelRatio() {
        return 1;
    }
}

const getStubMap = () => new StubMap() as any;

function createStyle(map = getStubMap()) {
    const style = new Style(map);
    map.style = style;
    return style;
}

let sinonFakeXMLServer;
let sinonFakeServer;
let _self;
let mockConsoleError;

beforeEach(() => {
    global.fetch = null;
    sinonFakeServer = fakeServer.create();
    sinonFakeXMLServer = fakeXhr.useFakeXMLHttpRequest();

    _self = {
        addEventListener() {}
    } as any as WorkerGlobalScopeInterface & typeof globalThis;
    global.self = _self;

    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
    sinonFakeXMLServer.restore();
    sinonFakeServer.restore();

    global.self = undefined;

    mockConsoleError.mockRestore();
});

describe('Style', () => {
    test('registers plugin state change listener', () => {
        clearRTLTextPlugin();

        jest.spyOn(Style, 'registerForPluginStateChange');
        const style = new Style(getStubMap());
        const mockStyleDispatcherBroadcast = jest.spyOn(style.dispatcher, 'broadcast');
        expect(Style.registerForPluginStateChange).toHaveBeenCalledTimes(1);

        setRTLTextPlugin('/plugin.js', undefined);
        expect(mockStyleDispatcherBroadcast.mock.calls[0][0]).toBe('syncRTLPluginState');
        expect(mockStyleDispatcherBroadcast.mock.calls[0][1]).toEqual({
            pluginStatus: 'deferred',
            pluginURL: 'http://localhost/plugin.js',
        });
    });

    test('loads plugin immediately if already registered', done => {
        clearRTLTextPlugin();
        sinonFakeServer.respondWith('/plugin.js', 'doesn\'t matter');
        setRTLTextPlugin('/plugin.js', (error) => {
            expect(error).toMatch(/Cannot set the state of the rtl-text-plugin when not in the web-worker context/);
            done();
        });
        sinonFakeServer.respond();
        new Style(createStyleJSON());
    });
});

describe('Style#loadURL', () => {
    test('fires "dataloading"', () => {
        const style = new Style(getStubMap());
        const spy = jest.fn();

        style.on('dataloading', spy);
        style.loadURL('style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toBe(style);
        expect(spy.mock.calls[0][0].dataType).toBe('style');
    });

    test('transforms style URL before request', () => {
        const map = getStubMap();
        const spy = jest.spyOn(map._requestManager, 'transformRequest');

        const style = new Style(map);
        style.loadURL('style.json');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('style.json');
        expect(spy.mock.calls[0][1]).toBe('Style');
    });

    test('validates the style', done => {
        const style = new Style(getStubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            expect(error.message).toMatch(/version/);
            done();
        });

        style.loadURL('style.json');
        sinonFakeServer.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        sinonFakeServer.respond();
    });

    test('cancels pending requests if removed', () => {
        const style = new Style(getStubMap());
        style.loadURL('style.json');
        style._remove();
        expect(sinonFakeServer.lastRequest.aborted).toBe(true);
    });
});

describe('Style#loadJSON', () => {
    test('fires "dataloading" (synchronously)', () => {
        const style = new Style(getStubMap());
        const spy = jest.fn();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].target).toBe(style);
        expect(spy.mock.calls[0][0].dataType).toBe('style');
    });

    test('fires "data" (asynchronously)', done => {
        const style = new Style(getStubMap());

        style.loadJSON(createStyleJSON());

        style.on('data', (e) => {
            expect(e.target).toBe(style);
            expect(e.dataType).toBe('style');
            done();
        });
    });

    test('fires "data" when the sprite finishes loading', done => {
        // Stubbing to bypass Web APIs that supported by jsdom:
        // * `URL.createObjectURL` in ajax.getImage (https://github.com/tmpvar/jsdom/issues/1721)
        // * `canvas.getContext('2d')` in browser.getImageData
        jest.spyOn(browser, 'getImageData');
        // stub Image so we can invoke 'onload'
        // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c

        // fake the image request (sinon doesn't allow non-string data for
        // server.respondWith, so we do so manually)
        const requests = [];
        sinonFakeXMLServer.onCreate = req => { requests.push(req); };
        const respond = () => {
            let req = requests.find(req => req.url === 'http://example.com/sprite.png');
            req.setStatus(200);
            req.response = new ArrayBuffer(8);
            req.onload();

            req = requests.find(req => req.url === 'http://example.com/sprite.json');
            req.setStatus(200);
            req.response = '{}';
            req.onload();
        };

        const style = new Style(getStubMap());

        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [],
            'sprite': 'http://example.com/sprite'
        });

        style.once('error', (e) => expect(e).toBeFalsy());

        style.once('data', (e) => {
            expect(e.target).toBe(style);
            expect(e.dataType).toBe('style');

            style.once('data', (e) => {
                expect(e.target).toBe(style);
                expect(e.dataType).toBe('style');
                done();
            });

            respond();
        });
    });

    test('validates the style', done => {
        const style = new Style(getStubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            expect(error.message).toMatch(/version/);
            done();
        });

        style.loadJSON(createStyleJSON({version: 'invalid'}));
    });

    test('creates sources', done => {
        const style = createStyle();

        style.on('style.load', () => {
            expect(style.sourceCaches['mapLibre'] instanceof SourceCache).toBeTruthy();
            done();
        });

        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapLibre': {
                    'type': 'vector',
                    'tiles': []
                }
            }
        }));
    });

    test('creates layers', done => {
        const style = createStyle();

        style.on('style.load', () => {
            expect(style.getLayer('fill') instanceof StyleLayer).toBeTruthy();
            done();
        });

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
    });

    test('transforms sprite json and image URLs before request', done => {
        const map = getStubMap();
        const transformSpy = jest.spyOn(map._requestManager, 'transformRequest');
        const style = createStyle(map);

        style.on('style.load', () => {
            expect(transformSpy).toHaveBeenCalledTimes(2);
            expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/sprites/bright-v8.json');
            expect(transformSpy.mock.calls[0][1]).toBe('SpriteJSON');
            expect(transformSpy.mock.calls[1][0]).toBe('http://example.com/sprites/bright-v8.png');
            expect(transformSpy.mock.calls[1][1]).toBe('SpriteImage');
            done();
        });

        style.loadJSON(extend(createStyleJSON(), {
            'sprite': 'http://example.com/sprites/bright-v8'
        }));
    });

    test('emits an error on non-existant vector source layer', done => {
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
    });

    test('sets up layer event forwarding', done => {
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
    });
});

describe('Style#_remove', () => {
    test('removes cache sources and clears their tiles', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            jest.spyOn(sourceCache, 'setEventedParent');
            jest.spyOn(sourceCache, 'onRemove');
            jest.spyOn(sourceCache, 'clearTiles');

            style._remove();

            expect(sourceCache.setEventedParent).toHaveBeenCalledWith(null);
            expect(sourceCache.onRemove).toHaveBeenCalledWith(style.map);
            expect(sourceCache.clearTiles).toHaveBeenCalled();

            done();
        });
    });

    test('deregisters plugin listener', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const mockStyleDispatcherBroadcast = jest.spyOn(style.dispatcher, 'broadcast');

        style.on('style.load', () => {
            style._remove();

            rtlTextPluginEvented.fire(new Event('pluginStateChange'));
            expect(mockStyleDispatcherBroadcast).not.toHaveBeenCalledWith('syncRTLPluginState');
            done();
        });
    });
});

describe('Style#update', () => {
    test('on error', done => {
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

            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value['layers'].map((layer) => { return layer.id; })).toEqual(['first', 'third']);
                expect(value['removedIds']).toEqual(['second']);
                done();
            };

            style.update({} as EvaluationParameters);
        });
    });
});

describe('Style#setState', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setState(createStyleJSON())).toThrow(/load/i);
    });

    test('do nothing if there are no changes', done => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        jest.spyOn(style, 'addLayer').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'removeLayer').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setPaintProperty').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setLayoutProperty').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setFilter').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'addSource').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'removeSource').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setGeoJSONSourceData').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setLayerZoomRange').mockImplementation(() => done('test failed'));
        jest.spyOn(style, 'setLight').mockImplementation(() => done('test failed'));
        style.on('style.load', () => {
            const didChange = style.setState(createStyleJSON());
            expect(didChange).toBeFalsy();
            done();
        });
    });

    test('Issue #3893: compare new source options against originally provided options rather than normalized properties', done => {
        sinonFakeServer.respondWith('/tilejson.json', JSON.stringify({
            tiles: ['http://tiles.server']
        }));
        const initial = createStyleJSON();
        initial.sources.mySource = {
            type: 'raster',
            url: '/tilejson.json'
        };
        const style = new Style(getStubMap());
        style.loadJSON(initial);
        style.on('style.load', () => {
            jest.spyOn(style, 'removeSource').mockImplementation(() => done('test failed: removeSource called'));
            jest.spyOn(style, 'addSource').mockImplementation(() => done('test failed: addSource called'));
            style.setState(initial);
            done();
        });
        sinonFakeServer.respond();
    });

    test('return true if there is a change', done => {
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
        style.on('style.load', () => {
            const didChange = style.setState(nextState);
            expect(didChange).toBeTruthy();
            expect(style.stylesheet).toEqual(nextState);
            done();
        });
    });

    test('sets GeoJSON source data if different', done => {
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

        style.on('style.load', () => {
            const geoJSONSource = style.sourceCaches['source-id'].getSource() as GeoJSONSource;
            const mockStyleSetGeoJSONSourceDate = jest.spyOn(style, 'setGeoJSONSourceData');
            const mockGeoJSONSourceSetData = jest.spyOn(geoJSONSource, 'setData');
            const didChange = style.setState(nextState);

            expect(mockStyleSetGeoJSONSourceDate).toHaveBeenCalledWith('source-id', geoJSONSourceData);
            expect(mockGeoJSONSourceSetData).toHaveBeenCalledWith(geoJSONSourceData);
            expect(didChange).toBeTruthy();
            expect(style.stylesheet).toEqual(nextState);
            done();
        });
    });
});

describe('Style#addSource', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.addSource('source-id', createSource())).toThrow(/load/i);
    });

    test('throw if missing source type', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        style.on('style.load', () => {
            expect(() => style.addSource('source-id', source)).toThrow(/type/i);
            done();
        });
    });

    test('fires "data" event', done => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', () => { done(); });
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update({} as EvaluationParameters);
        });
    });

    test('throws on duplicates', done => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.on('style.load', () => {
            style.addSource('source-id', source);
            expect(() => {
                style.addSource('source-id', source);
            }).toThrow(/Source "source-id" already exists./);
            done();
        });
    });

    test('sets up source event forwarding', done => {
        let one = 0;
        let two = 0;
        let three = 0;
        let four = 0;
        const checkVisited = () => {
            if (one === 1 && two === 1 && three === 1 && four === 1) {
                done();
            }
        };
        const style = createStyle();
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        style.on('style.load', () => {
            style.on('error', () => {
                one = 1;
                checkVisited();
            });
            style.on('data', (e) => {
                if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                    two = 1;
                    checkVisited();
                } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                    three = 1;
                    checkVisited();
                } else {
                    four = 1;
                    checkVisited();
                }
            });

            style.addSource('source-id', source); // fires data twice
            style.sourceCaches['source-id'].fire(new Event('error'));
            style.sourceCaches['source-id'].fire(new Event('data'));
        });
    });
});

describe('Style#removeSource', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.removeSource('source-id')).toThrow(/load/i);
    });

    test('fires "data" event', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', () => { done(); });
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update({} as EvaluationParameters);
        });
    });

    test('clears tiles', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            jest.spyOn(sourceCache, 'clearTiles');
            style.removeSource('source-id');
            expect(sourceCache.clearTiles).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('throws on non-existence', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => {
                style.removeSource('source-id');
            }).toThrow(/There is no source with this ID/);
            done();
        });
    });

    function createStyle(callback) {
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
        style.on('style.load', () => {
            style.update(1 as any as EvaluationParameters);
            callback(style);
        });
        return style;
    }

    test('throws if source is in use', done => {
        createStyle((style) => {
            style.on('error', (event) => {
                expect(event.error.message.includes('"mapLibre-source"')).toBeTruthy();
                expect(event.error.message.includes('"mapLibre-layer"')).toBeTruthy();
                done();
            });
            style.removeSource('mapLibre-source');
        });
    });

    test('does not throw if source is not in use', done => {
        createStyle((style) => {
            style.on('error', () => {
                done('test failed');
            });
            style.removeLayer('mapLibre-layer');
            style.removeSource('mapLibre-source');
            done();
        });
    });

    test('tears down source event forwarding', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();

        style.on('style.load', () => {
            style.addSource('source-id', source);
            const sourceCache = style.sourceCaches['source-id'];

            style.removeSource('source-id');

            // Suppress error reporting
            sourceCache.on('error', () => {});

            style.on('data', () => { expect(false).toBeTruthy(); });
            style.on('error', () => { expect(false).toBeTruthy(); });
            sourceCache.fire(new Event('data'));
            sourceCache.fire(new Event('error'));

            done();
        });
    });
});

describe('Style#setGeoJSONSourceData', () => {
    const geoJSON = {type: 'FeatureCollection', features: []} as GeoJSON.GeoJSON;

    test('throws before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/load/i);
    });

    test('throws on non-existence', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/There is no source with this ID/);
            done();
        });
    });
});

describe('Style#addLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.addLayer({id: 'background', type: 'background'})).toThrow(/load/i);
    });

    test('sets up layer event forwarding', done => {
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
    });

    test('throws on non-existant vector source layer', done => {
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
    });

    test('emits error on invalid layer', done => {
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
    });

    test('#4040 does not mutate source property when provided inline', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            const source = {
                'type': 'geojson',
                'data': {
                    'type': 'Point',
                    'coordinates': [ 0, 0]
                }
            };
            const layer = {id: 'inline-source-layer', type: 'circle', source} as any as LayerSpecification;
            style.addLayer(layer);
            expect((layer as any).source).toEqual(source);
            done();
        });
    });

    test('reloads source', done => {
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
                style.sourceCaches['mapLibre'].reload = function() { done(); };
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });
    });

    test('#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it', done => {
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
                style.sourceCaches['mapLibre'].reload = function() { done(); };
                style.sourceCaches['mapLibre'].clearTiles =  function() { done('test failed'); };
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });

    });

    test('clears source (instead of reloading) if adding this layer with a different type, immediately after removing it', done => {
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
                style.sourceCaches['mapLibre'].reload =  function() { done('test failed'); };
                style.sourceCaches['mapLibre'].clearTiles = function() { done(); };
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({} as EvaluationParameters);
            }
        });

    });

    test('fires "data" event', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        style.once('data', () => { done(); });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update({} as EvaluationParameters);
        });
    });

    test('emits error on duplicates', done => {
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
    });

    test('adds to the end by default', done => {
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
            style.addLayer(layer);
            expect(style._order).toEqual(['a', 'b', 'c']);
            done();
        });
    });

    test('adds before the given layer', done => {
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
            style.addLayer(layer, 'a');
            expect(style._order).toEqual(['c', 'a', 'b']);
            done();
        });
    });

    test('fire error if before layer does not exist', done => {
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
    });

    test('fires an error on non-existant source layer', done => {
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

    });
});

describe('Style#removeLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.removeLayer('background')).toThrow(/load/i);
    });

    test('fires "data" event', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        style.once('data', () => { done(); });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update({} as EvaluationParameters);
        });
    });

    test('tears down layer event forwarding', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', () => {
            done('test failed');
        });

        style.on('style.load', () => {
            const layer = style._layers.background;
            style.removeLayer('background');

            // Bind a listener to prevent fallback Evented error reporting.
            layer.on('error', () => {});

            layer.fire(new Event('error', {mapLibre: true}));
            done();
        });
    });

    test('fires an error on non-existence', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/Cannot remove non-existing layer "background"./);
                done();
            });
            style.removeLayer('background');
        });
    });

    test('removes from the order', done => {
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

        style.on('style.load', () => {
            style.removeLayer('a');
            expect(style._order).toEqual(['b']);
            done();
        });
    });

    test('does not remove dereffed layers', done => {
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

        style.on('style.load', () => {
            style.removeLayer('a');
            expect(style.getLayer('a')).toBeUndefined();
            expect(style.getLayer('b')).toBeDefined();
            done();
        });
    });
});

describe('Style#moveLayer', () => {
    test('throw before loaded', () => {
        const style = new Style(getStubMap());
        expect(() => style.moveLayer('background')).toThrow(/load/i);
    });

    test('fires "data" event', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'} as LayerSpecification;

        style.once('data', () => { done(); });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.moveLayer('background');
            style.update({} as EvaluationParameters);
        });
    });

    test('fires an error on non-existence', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/does not exist in the map\'s style and cannot be moved/);
                done();
            });
            style.moveLayer('background');
        });
    });

    test('changes the order', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        style.on('style.load', () => {
            style.moveLayer('a', 'c');
            expect(style._order).toEqual(['b', 'a', 'c']);
            done();
        });
    });

    test('moves to existing location', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
                {id: 'c', type: 'background'}
            ]
        }));

        style.on('style.load', () => {
            style.moveLayer('b', 'b');
            expect(style._order).toEqual(['a', 'b', 'c']);
            done();
        });
    });
});

describe('Style#setPaintProperty', () => {
    test('#4738 postpones source reload until layers have been broadcast to workers', done => {
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

        const tr = new Transform();
        tr.resize(512, 512);

        style.once('style.load', () => {
            style.update(tr.zoom as any as EvaluationParameters);
            const sourceCache = style.sourceCaches['geojson'];
            const source = style.getSource('geojson');

            let begun = false;
            let styleUpdateCalled = false;

            (source as any).on('data', (e) => setTimeout(() => {
                if (!begun && sourceCache.loaded()) {
                    begun = true;
                    jest.spyOn(sourceCache, 'reload').mockImplementation(() => {
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
    });

    test('#5802 clones the input', done => {
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

        style.on('style.load', () => {
            const value = {stops: [[0, 'red'], [10, 'blue']]};
            style.setPaintProperty('background', 'background-color', value);
            expect(style.getPaintProperty('background', 'background-color')).not.toBe(value);
            expect(style._changed).toBeTruthy();

            style.update({} as EvaluationParameters);
            expect(style._changed).toBeFalsy();

            value.stops[0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    test('respects validate option', done => {
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

        style.on('style.load', () => {
            const backgroundLayer = style.getLayer('background');
            const validate = jest.spyOn(backgroundLayer, '_validate');

            style.setPaintProperty('background', 'background-color', 'notacolor', {validate: false});
            expect(validate.mock.calls[0][4]).toEqual({validate: false});
            expect(mockConsoleError).not.toHaveBeenCalled();

            expect(style._changed).toBeTruthy();
            style.update({} as EvaluationParameters);

            style.setPaintProperty('background', 'background-color', 'alsonotacolor');
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(validate.mock.calls[1][4]).toEqual({});

            done();
        });
    });
});

describe('Style#getPaintProperty', () => {
    test('#5802 clones the output', done => {
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

        style.on('style.load', () => {
            style.setPaintProperty('background', 'background-color', {stops: [[0, 'red'], [10, 'blue']]});
            style.update({} as EvaluationParameters);
            expect(style._changed).toBeFalsy();

            const value = style.getPaintProperty('background', 'background-color');
            value['stops'][0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });
});

describe('Style#setLayoutProperty', () => {
    test('#5802 clones the input', done => {
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

        style.on('style.load', () => {
            const value = {stops: [[0, 'butt'], [10, 'round']]};
            style.setLayoutProperty('line', 'line-cap', value);
            expect(style.getLayoutProperty('line', 'line-cap')).not.toBe(value);
            expect(style._changed).toBeTruthy();

            style.update({} as EvaluationParameters);
            expect(style._changed).toBeFalsy();

            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    test('respects validate option', done => {
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

        style.on('style.load', () => {
            const lineLayer = style.getLayer('line');
            const validate = jest.spyOn(lineLayer, '_validate');

            style.setLayoutProperty('line', 'line-cap', 'invalidcap', {validate: false});
            expect(validate.mock.calls[0][4]).toEqual({validate: false});
            expect(mockConsoleError).not.toHaveBeenCalled();
            expect(style._changed).toBeTruthy();
            style.update({} as EvaluationParameters);

            style.setLayoutProperty('line', 'line-cap', 'differentinvalidcap');
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(validate.mock.calls[1][4]).toEqual({});

            done();
        });
    });
});

describe('Style#getLayoutProperty', () => {
    test('#5802 clones the output', done => {
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

        style.on('style.load', () => {
            style.setLayoutProperty('line', 'line-cap', {stops: [[0, 'butt'], [10, 'round']]});
            style.update({} as EvaluationParameters);
            expect(style._changed).toBeFalsy();

            const value = style.getLayoutProperty('line', 'line-cap');
            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            expect(style._changed).toBeTruthy();

            done();
        });
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
                geojson: createGeoJSONSource() as GeoJSONSourceSpecification
            },
            layers: [
                {id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0]}
            ]
        });
        return style;
    }

    test('sets filter', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toEqual(['==', 'id', 1]);
                done();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 1]);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    });

    test('gets a clone of the filter', done => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter1 = ['==', 'id', 1] as FilterSpecification;
            style.setFilter('symbol', filter1);
            const filter2 = style.getFilter('symbol');
            const filter3 = style.getLayer('symbol').filter;

            expect(filter1).not.toBe(filter2);
            expect(filter1).not.toBe(filter3);
            expect(filter2).not.toBe(filter3);

            done();
        });
    });

    test('sets again mutated filter', done => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter = ['==', 'id', 1] as FilterSpecification;
            style.setFilter('symbol', filter);
            style.update({} as EvaluationParameters); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toEqual(['==', 'id', 2]);
                done();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    });

    test('unsets filter', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.setFilter('symbol', null);
            expect(style.getLayer('symbol').serialize()['filter']).toBeUndefined();
            done();
        });
    });

    test('emits if invalid', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.getLayer('symbol').serialize()['filter']).toEqual(['==', 'id', 0]);
                done();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    test('fires an error if layer not found', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/Cannot filter non-existing layer "non-existant"./);
                done();
            });
            style.setFilter('non-existant', ['==', 'id', 1]);
        });
    });

    test('validates filter by default', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.setFilter('symbol', 'notafilter' as any as FilterSpecification);
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 0]);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
            done();
        });
    });

    test('respects validate option', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value['layers'][0].id).toBe('symbol');
                expect(value['layers'][0].filter).toBe('notafilter');
                done();
            };

            style.setFilter('symbol', 'notafilter' as any as FilterSpecification, {validate: false});
            expect(style.getFilter('symbol')).toBe('notafilter');
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    });
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
                'geojson': createGeoJSONSource() as GeoJSONSourceSpecification
            },
            'layers': [{
                'id': 'symbol',
                'type': 'symbol',
                'source': 'geojson'
            }]
        });
        return style;
    }

    test('sets zoom range', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value['layers'].map((layer) => { return layer.id; })).toEqual(['symbol']);
                done();
            };
            style.setLayerZoomRange('symbol', 5, 12);
            expect(style.getLayer('symbol').minzoom).toBe(5);
            expect(style.getLayer('symbol').maxzoom).toBe(12);
            style.update({} as EvaluationParameters); // trigger dispatcher broadcast
        });
    });

    test('fires an error if layer not found', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', ({error}) => {
                expect(error.message).toMatch(/Cannot set the zoom range of non-existing layer "non-existant"./);
                done();
            });
            style.setLayerZoomRange('non-existant', 5, 12);
        });
    });

    test('does not reload raster source', done => {
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

        style.on('style.load', () => {
            jest.spyOn(style, '_reloadSource');

            style.setLayerZoomRange('raster', 5, 12);
            style.update(0 as any as EvaluationParameters);
            expect(style._reloadSource).not.toHaveBeenCalled();
            done();
        });
    });
});

describe('Style#queryRenderedFeatures', () => {

    let style;
    let transform;

    beforeEach((callback) => {
        style = new Style(getStubMap());
        transform = new Transform();
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
                    if (params.layers.indexOf(l) < 0) {
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
                    tile: {queryRenderedFeatures: queryMapLibreFeatures},
                    tileID: new OverscaledTileID(0, 0, 0, 0, 0),
                    queryGeometry: [],
                    scale: 1
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
    });

    afterEach(() => {
        style = undefined;
        transform = undefined;
    });

    test('returns feature type', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
        expect(results[0].geometry.type).toBe('Line');
    });

    test('filters by `layers` option', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land']}, transform);
        expect(results).toHaveLength(2);
    });

    test('checks type of `layers` option', () => {
        let errors = 0;
        jest.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error'] && event['error'].message.includes('parameters.layers must be an Array.')) {
                errors++;
            }
        });
        style.queryRenderedFeatures([{x: 0, y: 0}], {layers:'string'}, transform);
        expect(errors).toBe(1);
    });

    test('includes layout properties', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
        const layout = results[0].layer.layout;
        expect(layout['line-cap']).toBe('round');
    });

    test('includes paint properties', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
        expect(results[2].layer.paint['line-color']).toBe('red');
    });

    test('includes metadata', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);

        const layer = results[1].layer;
        expect(layer.metadata.something).toBe('else');

    });

    test('include multiple layers', () => {
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land', 'landref']}, transform);
        expect(results).toHaveLength(3);
    });

    test('does not query sources not implicated by `layers` parameter', () => {
        style.sourceCaches.mapLibre.queryRenderedFeatures = function() { expect(true).toBe(false); };
        style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land--other']}, transform);
    });

    test('fires an error if layer included in params does not exist on the style', () => {
        let errors = 0;
        jest.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error'] && event['error'].message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
        });
        const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers:['merp']}, transform);
        expect(errors).toBe(1);
        expect(results).toHaveLength(0);
    });
});

describe('Style defers  ...', () => {
    test('... expensive methods', done => {
        const style = new Style(getStubMap());
        style.loadJSON(createStyleJSON({
            'sources': {
                'streets': createGeoJSONSource(),
                'terrain': createGeoJSONSource()
            }
        }));

        style.on('style.load', () => {
            style.update({} as EvaluationParameters);

            // spies to track defered methods
            const mockStyleFire = jest.spyOn(style, 'fire');
            jest.spyOn(style, '_reloadSource');
            jest.spyOn(style, '_updateWorkerLayers');

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

            done();
        });
    });
});

describe('Style#query*Features', () => {

    // These tests only cover filter validation. Most tests for these methods
    // live in the integration tests.

    let style;
    let onError;
    let transform;

    beforeEach((callback) => {
        transform = new Transform();
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

        onError = jest.fn();

        style.on('error', onError)
            .on('style.load', () => {
                callback();
            });
    });

    test('querySourceFeatures emits an error on incorrect filter', () => {
        expect(style.querySourceFeatures([10, 100], {filter: 7}, transform)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/querySourceFeatures\.filter/);
    });

    test('queryRenderedFeatures emits an error on incorrect filter', () => {
        expect(style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 7}, transform)).toEqual([]);
        expect(onError.mock.calls[0][0].error.message).toMatch(/queryRenderedFeatures\.filter/);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        jest.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error']) {
                errors++;
            }
        });
        style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 'invalidFilter', validate: false}, transform);
        expect(errors).toBe(0);
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', () => {
        let errors = 0;
        jest.spyOn(style, 'fire').mockImplementation((event) => {
            if (event['error']) errors++;
        });
        style.querySourceFeatures([{x: 0, y: 0}], {filter: 'invalidFilter', validate: false}, transform);
        expect(errors).toBe(0);
    });
});

describe('Style#addSourceType', () => {
    const _types = {'existing' () {}};

    jest.spyOn(Style, 'getSourceType').mockImplementation(name => _types[name]);
    jest.spyOn(Style, 'setSourceType').mockImplementation((name, create) => {
        _types[name] = create;
    });

    test('adds factory function', done => {
        const style = new Style(getStubMap());
        const sourceType = function () {} as any as SourceClass;

        // expect no call to load worker source
        style.dispatcher.broadcast = function (type) {
            if (type === 'loadWorkerSource') {
                done('test failed');
            }
        };

        style.addSourceType('foo', sourceType, () => {
            expect(_types['foo']).toBe(sourceType);
            done();
        });
    });

    test('triggers workers to load worker source code', done => {
        const style = new Style(getStubMap());
        const sourceType = function () {} as any as SourceClass;
        sourceType.workerSourceURL = 'worker-source.js' as any as URL;

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'loadWorkerSource') {
                expect(_types['bar']).toBe(sourceType);
                expect(params['name']).toBe('bar');
                expect(params['url']).toBe('worker-source.js');
                done();
            }
        };

        style.addSourceType('bar', sourceType, (err) => { expect(err).toBeFalsy(); });
    });

    test('refuses to add new type over existing name', done => {
        const style = new Style(getStubMap());
        const sourceType = function () {} as any as SourceClass;
        style.addSourceType('existing', sourceType, (err) => {
            expect(err).toBeTruthy();
            done();
        });
    });
});

describe('Style#hasTransitions', () => {
    test('returns false when the style is loading', () => {
        const style = new Style(getStubMap());
        expect(style.hasTransitions()).toBe(false);
    });

    test('returns true when a property is transitioning', done => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [{
                'id': 'background',
                'type': 'background'
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty('background', 'background-color', 'blue');
            style.update({transition: {duration: 300, delay: 0}} as EvaluationParameters);
            expect(style.hasTransitions()).toBe(true);
            done();
        });
    });

    test('returns false when a property is not transitioning', done => {
        const style = new Style(getStubMap());
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': [{
                'id': 'background',
                'type': 'background'
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty('background', 'background-color', 'blue');
            style.update({transition: {duration: 0, delay: 0}} as EvaluationParameters);
            expect(style.hasTransitions()).toBe(false);
            done();
        });
    });
});
