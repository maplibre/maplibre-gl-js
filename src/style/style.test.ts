import '../../stub_loader';
import Style from '../style/style';
import SourceCache from '../source/source_cache';
import StyleLayer from '../style/style_layer';
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

function createStyleJSON(properties) {
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
        attribution: 'Mapbox',
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    };
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
    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
    }

    _getMapId() {
        return 1;
    }
}

describe('Style', done => {
    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        window.clearFakeWorkerPresence();
        callback();
    });

    test('registers plugin state change listener', done => {
        clearRTLTextPlugin();
        window.useFakeXMLHttpRequest();
        window.useFakeWorkerPresence();
        jest.spyOn(Style, 'registerForPluginStateChange');
        const style = new Style(new StubMap());
        jest.spyOn(style.dispatcher, 'broadcast');
        expect(Style.registerForPluginStateChange.calledOnce).toBeTruthy();

        setRTLTextPlugin('/plugin.js',);
        expect(style.dispatcher.broadcast.calledWith('syncRTLPluginState', {
            pluginStatus: 'deferred',
            pluginURL: '/plugin.js'
        })).toBeTruthy();
        window.clearFakeWorkerPresence();
        done();
    });

    test('loads plugin immediately if already registered', done => {
        clearRTLTextPlugin();
        window.useFakeXMLHttpRequest();
        window.useFakeWorkerPresence();
        window.server.respondWith('/plugin.js', 'doesn\'t matter');
        let firstError = true;
        setRTLTextPlugin('/plugin.js', (error) => {
            // Getting this error message shows the bogus URL was succesfully passed to the worker
            // We'll get the error from all workers, only pay attention to the first one
            if (firstError) {
                expect(error.message).toBe('RTL Text Plugin failed to import scripts from /plugin.js');
                done();
                window.clearFakeWorkerPresence();
                window.clearFakeXMLHttpRequest();
                firstError = false;
            }
        });
        window.server.respond();
        new Style(createStyleJSON());
    });

    done();
});

describe('Style#loadURL', done => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    test('fires "dataloading"', done => {
        const style = new Style(new StubMap());
        const spy = jest.fn();

        style.on('dataloading', spy);
        style.loadURL('style.json');

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0].target).toBe(style);
        expect(spy.getCall(0).args[0].dataType).toBe('style');
        done();
    });

    test('transforms style URL before request', done => {
        const map = new StubMap();
        const spy = jest.spyOn(map._requestManager, 'transformRequest');

        const style = new Style(map);
        style.loadURL('style.json');

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0]).toBe('style.json');
        expect(spy.getCall(0).args[1]).toBe('Style');
        done();
    });

    test('validates the style', done => {
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            t.match(error.message, /version/);
            done();
        });

        style.loadURL('style.json');
        window.server.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    test('cancels pending requests if removed', done => {
        const style = new Style(new StubMap());
        style.loadURL('style.json');
        style._remove();
        expect(window.server.lastRequest.aborted).toBe(true);
        done();
    });

    done();
});

describe('Style#loadJSON', done => {
    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    test('fires "dataloading" (synchronously)', done => {
        const style = new Style(new StubMap());
        const spy = jest.fn();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0].target).toBe(style);
        expect(spy.getCall(0).args[0].dataType).toBe('style');
        done();
    });

    test('fires "data" (asynchronously)', done => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());

        style.on('data', (e) => {
            expect(e.target).toBe(style);
            expect(e.dataType).toBe('style');
            done();
        });
    });

    test('fires "data" when the sprite finishes loading', done => {
        window.useFakeXMLHttpRequest();

        // Stubbing to bypass Web APIs that supported by jsdom:
        // * `URL.createObjectURL` in ajax.getImage (https://github.com/tmpvar/jsdom/issues/1721)
        // * `canvas.getContext('2d')` in browser.getImageData
        t.stub(browser, 'getImageData');
        // stub Image so we can invoke 'onload'
        // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c

        // fake the image request (sinon doesn't allow non-string data for
        // server.respondWith, so we do so manually)
        const requests = [];
        XMLHttpRequest.onCreate = req => { requests.push(req); };
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

        const style = new Style(new StubMap());

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
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            t.match(error.message, /version/);
            done();
        });

        style.loadJSON(createStyleJSON({version: 'invalid'}));
    });

    test('creates sources', done => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            expect(style.sourceCaches['mapbox'] instanceof SourceCache).toBeTruthy();
            done();
        });

        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapbox': {
                    'type': 'vector',
                    'tiles': []
                }
            }
        }));
    });

    test('creates layers', done => {
        const style = new Style(new StubMap());

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
        window.useFakeXMLHttpRequest();

        const map = new StubMap();
        const transformSpy = jest.spyOn(map._requestManager, 'transformRequest');
        const style = new Style(map);

        style.on('style.load', () => {
            expect(transformSpy).toHaveBeenCalledTimes(2);
            expect(transformSpy.getCall(0).args[0]).toBe('http://example.com/sprites/bright-v8.json');
            expect(transformSpy.getCall(0).args[1]).toBe('SpriteJSON');
            expect(transformSpy.getCall(1).args[0]).toBe('http://example.com/sprites/bright-v8.png');
            expect(transformSpy.getCall(1).args[1]).toBe('SpriteImage');
            done();
        });

        style.loadJSON(extend(createStyleJSON(), {
            'sprite': 'http://example.com/sprites/bright-v8'
        }));
    });

    test('emits an error on non-existant vector source layer', done => {
        const style = new Style(new StubMap());
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
            style.update({});
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
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', (e) => {
            expect(e.layer).toEqual({id: 'background'});
            expect(e.mapbox).toBeTruthy();
            done();
        });

        style.on('style.load', () => {
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    done();
});

describe('Style#_remove', done => {
    test('clears tiles', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            jest.spyOn(sourceCache, 'clearTiles');
            style._remove();
            expect(sourceCache.clearTiles.calledOnce).toBeTruthy();
            done();
        });
    });

    test('deregisters plugin listener', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        jest.spyOn(style.dispatcher, 'broadcast');

        style.on('style.load', () => {
            style._remove();

            rtlTextPluginEvented.fire(new Event('pluginStateChange'));
            expect(style.dispatcher.broadcast.calledWith('syncRTLPluginState')).toBeFalsy();
            done();
        });
    });

    done();
});

describe('Style#update', done => {
    const style = new Style(new StubMap());
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
            expect(value.layers.map((layer) => { return layer.id; })).toEqual(['first', 'third']);
            expect(value.removedIds).toEqual(['second']);
            done();
        };

        style.update({});
    });
});

describe('Style#setState', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.setState(createStyleJSON())).toThrow(/load/i);
        done();
    });

    test('do nothing if there are no changes', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        [
            'addLayer',
            'removeLayer',
            'setPaintProperty',
            'setLayoutProperty',
            'setFilter',
            'addSource',
            'removeSource',
            'setGeoJSONSourceData',
            'setLayerZoomRange',
            'setLight'
        ].forEach((method) => t.stub(style, method).callsFake(() => t.fail(`${method} called`)));
        style.on('style.load', () => {
            const didChange = style.setState(createStyleJSON());
            expect(didChange).toBeFalsy();
            done();
        });
    });

    test('Issue #3893: compare new source options against originally provided options rather than normalized properties', done => {
        window.useFakeXMLHttpRequest();
        window.server.respondWith('/tilejson.json', JSON.stringify({
            tiles: ['http://tiles.server']
        }));
        const initial = createStyleJSON();
        initial.sources.mySource = {
            type: 'raster',
            url: '/tilejson.json'
        };
        const style = new Style(new StubMap());
        style.loadJSON(initial);
        style.on('style.load', () => {
            t.stub(style, 'removeSource').callsFake(() => t.fail('removeSource called'));
            t.stub(style, 'addSource').callsFake(() => t.fail('addSource called'));
            style.setState(initial);
            window.clearFakeXMLHttpRequest();
            done();
        });
        window.server.respond();
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

        const style = new Style(new StubMap());
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

        const style = new Style(new StubMap());
        style.loadJSON(initialState);

        style.on('style.load', () => {
            const geoJSONSource = style.sourceCaches['source-id'].getSource();
            jest.spyOn(style, 'setGeoJSONSourceData');
            jest.spyOn(geoJSONSource, 'setData');
            const didChange = style.setState(nextState);

            expect(style.setGeoJSONSourceData.calledWith('source-id', geoJSONSourceData)).toBeTruthy();
            expect(geoJSONSource.setData.calledWith(geoJSONSourceData)).toBeTruthy();
            expect(didChange).toBeTruthy();
            expect(style.stylesheet).toEqual(nextState);
            done();
        });
    });

    done();
});

describe('Style#addSource', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.addSource('source-id', createSource())).toThrow(/load/i);
        done();
    });

    test('throw if missing source type', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        style.on('style.load', () => {
            expect(() => style.addSource('source-id', source)).toThrow(/type/i);
            done();
        });
    });

    test('fires "data" event', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update({});
        });
    });

    test('throws on duplicates', done => {
        const style = new Style(new StubMap());
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

    test('emits on invalid source', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.sourceCaches['source-id']).toBeFalsy();
                done();
            });
            style.addSource('source-id', {
                type: 'vector',
                minzoom: '1', // Shouldn't be a string
                maxzoom: 10,
                attribution: 'Mapbox',
                tiles: ['http://example.com/{z}/{x}/{y}.png']
            });
        });
    });

    test('sets up source event forwarding', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));
        const source = createSource();

        style.on('style.load', () => {
            expect.assertions(4);

            style.on('error', () => { expect(true).toBeTruthy(); });
            style.on('data', (e) => {
                if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                    expect(true).toBeTruthy();
                } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                    expect(true).toBeTruthy();
                } else {
                    expect(true).toBeTruthy();
                }
            });

            style.addSource('source-id', source); // fires data twice
            style.sourceCaches['source-id'].fire(new Event('error'));
            style.sourceCaches['source-id'].fire(new Event('data'));
        });
    });

    done();
});

describe('Style#removeSource', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.removeSource('source-id')).toThrow(/load/i);
        done();
    });

    test('fires "data" event', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.removeSource('source-id');
            style.update({});
        });
    });

    test('clears tiles', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            jest.spyOn(sourceCache, 'clearTiles');
            style.removeSource('source-id');
            expect(sourceCache.clearTiles.calledOnce).toBeTruthy();
            done();
        });
    });

    test('throws on non-existence', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => {
                style.removeSource('source-id');
            }).toThrow(/There is no source with this ID/);
            done();
        });
    });

    function createStyle(callback) {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            'sources': {
                'mapbox-source': createGeoJSONSource()
            },
            'layers': [{
                'id': 'mapbox-layer',
                'type': 'circle',
                'source': 'mapbox-source',
                'source-layer': 'whatever'
            }]
        }));
        style.on('style.load', () => {
            style.update(1, 0);
            callback(style);
        });
        return style;
    }

    test('throws if source is in use', done => {
        createStyle((style) => {
            style.on('error', (event) => {
                expect(event.error.message.includes('"mapbox-source"')).toBeTruthy();
                expect(event.error.message.includes('"mapbox-layer"')).toBeTruthy();
                done();
            });
            style.removeSource('mapbox-source');
        });
    });

    test('does not throw if source is not in use', done => {
        createStyle((style) => {
            style.on('error', () => {
                t.fail();
            });
            style.removeLayer('mapbox-layer');
            style.removeSource('mapbox-source');
            done();
        });
    });

    test('tears down source event forwarding', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        let source = createSource();

        style.on('style.load', () => {
            style.addSource('source-id', source);
            source = style.sourceCaches['source-id'];

            style.removeSource('source-id');

            // Suppress error reporting
            source.on('error', () => {});

            style.on('data', () => { expect(false).toBeTruthy(); });
            style.on('error', () => { expect(false).toBeTruthy(); });
            source.fire(new Event('data'));
            source.fire(new Event('error'));

            done();
        });
    });

    done();
});

describe('Style#setGeoJSONSourceData', done => {
    const geoJSON = {type: 'FeatureCollection', features: []};

    test('throws before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/load/i);
        done();
    });

    test('throws on non-existence', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrow(/There is no source with this ID/);
            done();
        });
    });

    done();
});

describe('Style#addLayer', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.addLayer({id: 'background', type: 'background'})).toThrow(/load/i);
        done();
    });

    test('sets up layer event forwarding', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('error', (e) => {
            expect(e.layer).toEqual({id: 'background'});
            expect(e.mapbox).toBeTruthy();
            done();
        });

        style.on('style.load', () => {
            style.addLayer({
                id: 'background',
                type: 'background'
            });
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    test('throws on non-existant vector source layer', done => {
        const style = new Style(new StubMap());
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
        const style = new Style(new StubMap());
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
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            const source = {
                'type': 'geojson',
                'data': {
                    'type': 'Point',
                    'coordinates': [ 0, 0]
                }
            };
            const layer = {id: 'inline-source-layer', type: 'circle', source};
            style.addLayer(layer);
            expect(layer.source).toEqual(source);
            done();
        });
    });

    test('reloads source', done => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapbox': {
                    'type': 'vector',
                    'tiles': []
                }
            }
        }));
        const layer = {
            'id': 'symbol',
            'type': 'symbol',
            'source': 'mapbox',
            'source-layer': 'boxmap',
            'filter': ['==', 'id', 0]
        };

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.end;
                style.addLayer(layer);
                style.update({});
            }
        });
    });

    test('#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it', done => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapbox': {
                    'type': 'vector',
                    'tiles': []
                }
            },
            layers: [{
                'id': 'my-layer',
                'type': 'symbol',
                'source': 'mapbox',
                'source-layer': 'boxmap',
                'filter': ['==', 'id', 0]
            }]
        }));

        const layer = {
            'id': 'my-layer',
            'type': 'symbol',
            'source': 'mapbox',
            'source-layer': 'boxmap'
        };

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.end;
                style.sourceCaches['mapbox'].clearTiles = t.fail;
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({});
            }
        });

    });

    test('clears source (instead of reloading) if adding this layer with a different type, immediately after removing it', done => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            'sources': {
                'mapbox': {
                    'type': 'vector',
                    'tiles': []
                }
            },
            layers: [{
                'id': 'my-layer',
                'type': 'symbol',
                'source': 'mapbox',
                'source-layer': 'boxmap',
                'filter': ['==', 'id', 0]
            }]
        }));

        const layer = {
            'id': 'my-layer',
            'type': 'circle',
            'source': 'mapbox',
            'source-layer': 'boxmap'
        };
        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.fail;
                style.sourceCaches['mapbox'].clearTiles = t.end;
                style.removeLayer('my-layer');
                style.addLayer(layer);
                style.update({});
            }
        });

    });

    test('fires "data" event', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update({});
        });
    });

    test('emits error on duplicates', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.on('error', (e) => {
            t.match(e.error, /already exists/);
            done();
        });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.addLayer(layer);
        });
    });

    test('adds to the end by default', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        style.on('style.load', () => {
            style.addLayer(layer);
            expect(style._order).toEqual(['a', 'b', 'c']);
            done();
        });
    });

    test('adds before the given layer', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        style.on('style.load', () => {
            style.addLayer(layer, 'a');
            expect(style._order).toEqual(['c', 'a', 'b']);
            done();
        });
    });

    test('fire error if before layer does not exist', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'a',
                type: 'background'
            }, {
                id: 'b',
                type: 'background'
            }]
        }));
        const layer = {id: 'c', type: 'background'};

        style.on('style.load', () => {
            style.on('error', (error) => {
                t.match(error.error, /Cannot add layer "c" before non-existing layer "z"./);
                done();
            });
            style.addLayer(layer, 'z');
        });
    });

    test('fires an error on non-existant source layer', done => {
        const style = new Style(new StubMap());
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
        };

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /does not exist on source/);
                done();
            });
            style.addLayer(layer);
        });

    });

    done();
});

describe('Style#removeLayer', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.removeLayer('background')).toThrow(/load/i);
        done();
    });

    test('fires "data" event', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.removeLayer('background');
            style.update({});
        });
    });

    test('tears down layer event forwarding', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            layers: [{
                id: 'background',
                type: 'background'
            }]
        }));

        style.on('error', () => {
            t.fail();
        });

        style.on('style.load', () => {
            const layer = style._layers.background;
            style.removeLayer('background');

            // Bind a listener to prevent fallback Evented error reporting.
            layer.on('error', () => {});

            layer.fire(new Event('error', {mapbox: true}));
            done();
        });
    });

    test('fires an error on non-existence', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot remove non-existing layer "background"./);
                done();
            });
            style.removeLayer('background');
        });
    });

    test('removes from the order', done => {
        const style = new Style(new StubMap());
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
        const style = new Style(new StubMap());
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

    done();
});

describe('Style#moveLayer', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.moveLayer('background')).toThrow(/load/i);
        done();
    });

    test('fires "data" event', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.moveLayer('background');
            style.update({});
        });
    });

    test('fires an error on non-existence', done => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /does not exist in the map\'s style and cannot be moved/);
                done();
            });
            style.moveLayer('background');
        });
    });

    test('changes the order', done => {
        const style = new Style(new StubMap());
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
        const style = new Style(new StubMap());
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

    done();
});

describe('Style#setPaintProperty', done => {
    test('#4738 postpones source reload until layers have been broadcast to workers', done => {
        const style = new Style(new StubMap());
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
            style.update(tr.zoom, 0);
            const sourceCache = style.sourceCaches['geojson'];
            const source = style.getSource('geojson');

            let begun = false;
            let styleUpdateCalled = false;

            source.on('data', (e) => setImmediate(() => {
                if (!begun && sourceCache.loaded()) {
                    begun = true;
                    t.stub(sourceCache, 'reload').callsFake(() => {
                        expect(styleUpdateCalled).toBeTruthy();
                        done();
                    });

                    source.setData({'type': 'FeatureCollection', 'features': []});
                    style.setPaintProperty('circle', 'circle-color', {type: 'identity', property: 'foo'});
                }

                if (begun && e.sourceDataType === 'content') {
                    // setData() worker-side work is complete; simulate an
                    // animation frame a few ms later, so that this test can
                    // confirm that SourceCache#reload() isn't called until
                    // after the next Style#update()
                    setTimeout(() => {
                        styleUpdateCalled = true;
                        style.update({});
                    }, 50);
                }
            }));
        });
    });

    test('#5802 clones the input', done => {
        const style = new Style(new StubMap());
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

            style.update({});
            expect(style._changed).toBeFalsy();

            value.stops[0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    test('respects validate option', done => {
        const style = new Style(new StubMap());
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
            t.stub(console, 'error');
            const validate = jest.spyOn(backgroundLayer, '_validate');

            style.setPaintProperty('background', 'background-color', 'notacolor', {validate: false});
            expect(validate.args[0][4]).toEqual({validate: false});
            expect(console.error).not.toHaveBeenCalled();

            expect(style._changed).toBeTruthy();
            style.update({});

            style.setPaintProperty('background', 'background-color', 'alsonotacolor');
            expect(console.error.calledOnce).toBeTruthy();
            expect(validate.args[1][4]).toEqual({});

            done();
        });
    });

    done();
});

describe('Style#getPaintProperty', done => {
    test('#5802 clones the output', done => {
        const style = new Style(new StubMap());
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
            style.update({});
            expect(style._changed).toBeFalsy();

            const value = style.getPaintProperty('background', 'background-color');
            value.stops[0][0] = 1;
            style.setPaintProperty('background', 'background-color', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    done();
});

describe('Style#setLayoutProperty', done => {
    test('#5802 clones the input', done => {
        const style = new Style(new StubMap());
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

            style.update({});
            expect(style._changed).toBeFalsy();

            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    test('respects validate option', done => {
        const style = new Style(new StubMap());
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
            t.stub(console, 'error');
            const validate = jest.spyOn(lineLayer, '_validate');

            style.setLayoutProperty('line', 'line-cap', 'invalidcap', {validate: false});
            expect(validate.args[0][4]).toEqual({validate: false});
            expect(console.error).not.toHaveBeenCalled();
            expect(style._changed).toBeTruthy();
            style.update({});

            style.setLayoutProperty('line', 'line-cap', 'differentinvalidcap');
            expect(console.error.calledOnce).toBeTruthy();
            expect(validate.args[1][4]).toEqual({});

            done();
        });
    });

    done();
});

describe('Style#getLayoutProperty', done => {
    test('#5802 clones the output', done => {
        const style = new Style(new StubMap());
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
            style.update({});
            expect(style._changed).toBeFalsy();

            const value = style.getLayoutProperty('line', 'line-cap');
            value.stops[0][0] = 1;
            style.setLayoutProperty('line', 'line-cap', value);
            expect(style._changed).toBeTruthy();

            done();
        });
    });

    done();
});

describe('Style#setFilter', done => {
    test('throws if style is not loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.setFilter('symbol', ['==', 'id', 1])).toThrow(/load/i);
        done();
    });

    function createStyle() {
        const style = new Style(new StubMap());
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

    test('sets filter', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toBe('symbol');
                expect(value.layers[0].filter).toEqual(['==', 'id', 1]);
                done();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 1]);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    test('gets a clone of the filter', done => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter1 = ['==', 'id', 1];
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
            const filter = ['==', 'id', 1];
            style.setFilter('symbol', filter);
            style.update({}); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toBe('symbol');
                expect(value.layers[0].filter).toEqual(['==', 'id', 2]);
                done();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    test('unsets filter', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.setFilter('symbol', null);
            expect(style.getLayer('symbol').serialize().filter).toBeUndefined();
            done();
        });
    });

    test('emits if invalid', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.getLayer('symbol').serialize().filter).toEqual(['==', 'id', 0]);
                done();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    test('fires an error if layer not found', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot filter non-existing layer "non-existant"./);
                done();
            });
            style.setFilter('non-existant', ['==', 'id', 1]);
        });
    });

    test('validates filter by default', done => {
        const style = createStyle();
        t.stub(console, 'error');
        style.on('style.load', () => {
            style.setFilter('symbol', 'notafilter');
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 0]);
            expect(console.error.calledOnce).toBeTruthy();
            style.update({}); // trigger dispatcher broadcast
            done();
        });
    });

    test('respects validate option', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toBe('symbol');
                expect(value.layers[0].filter).toBe('notafilter');
                done();
            };

            style.setFilter('symbol', 'notafilter', {validate: false});
            expect(style.getFilter('symbol')).toBe('notafilter');
            style.update({}); // trigger dispatcher broadcast
        });
    });

    done();
});

describe('Style#setLayerZoomRange', done => {
    test('throw before loaded', done => {
        const style = new Style(new StubMap());
        expect(() => style.setLayerZoomRange('symbol', 5, 12)).toThrow(/load/i);
        done();
    });

    function createStyle() {
        const style = new Style(new StubMap());
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

    test('sets zoom range', done => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.map((layer) => { return layer.id; })).toEqual(['symbol']);
            };

            style.setLayerZoomRange('symbol', 5, 12);
            expect(style.getLayer('symbol').minzoom).toBe(5);
            expect(style.getLayer('symbol').maxzoom).toBe(12);
            done();
        });
    });

    test('fires an error if layer not found', done => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot set the zoom range of non-existing layer "non-existant"./);
                done();
            });
            style.setLayerZoomRange('non-existant', 5, 12);
        });
    });

    test('does not reload raster source', done => {
        const style = new Style(new StubMap());
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
            style.update(0);
            expect(style._reloadSource.called).toBeFalsy();
            done();
        });
    });

    done();
});

describe('Style#queryRenderedFeatures', done => {
    const style = new Style(new StubMap());
    const transform = new Transform();
    transform.resize(512, 512);

    function queryMapboxFeatures(layers, serializedLayers, getFeatureState, queryGeom, cameraQueryGeom, scale, params) {
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
            'mapbox': {
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
            'source': 'mapbox',
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
        }, {
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
        style.sourceCaches.mapbox.tilesIn = () => {
            return [{
                tile: {queryRenderedFeatures: queryMapboxFeatures},
                tileID: new OverscaledTileID(0, 0, 0, 0, 0),
                queryGeometry: [],
                scale: 1
            }];
        };
        style.sourceCaches.other.tilesIn = () => {
            return [];
        };

        style.sourceCaches.mapbox.transform = transform;
        style.sourceCaches.other.transform = transform;

        style.update(0);
        style._updateSources(transform);

        test('returns feature type', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            expect(results[0].geometry.type).toBe('Line');
            done();
        });

        test('filters by `layers` option', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land']}, transform);
            expect(results).toHaveLength(2);
            done();
        });

        test('checks type of `layers` option', done => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('parameters.layers must be an Array.')) errors++;
            });
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers:'string'}, transform);
            expect(errors).toBe(1);
            done();
        });

        test('includes layout properties', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            const layout = results[0].layer.layout;
            expect(layout['line-cap']).toBe('round');
            done();
        });

        test('includes paint properties', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            expect(results[2].layer.paint['line-color']).toBe('red');
            done();
        });

        test('includes metadata', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);

            const layer = results[1].layer;
            expect(layer.metadata.something).toBe('else');

            done();
        });

        test('include multiple layers', done => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land', 'landref']}, transform);
            expect(results).toHaveLength(3);
            done();
        });

        test('does not query sources not implicated by `layers` parameter', done => {
            style.sourceCaches.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land--other']}, transform);
            done();
        });

        test('fires an error if layer included in params does not exist on the style', done => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            });
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers:['merp']}, transform);
            expect(errors).toBe(1);
            expect(results).toHaveLength(0);
            done();
        });

        done();
    });
});

describe('Style defers expensive methods', done => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON({
        'sources': {
            'streets': createGeoJSONSource(),
            'terrain': createGeoJSONSource()
        }
    }));

    style.on('style.load', () => {
        style.update({});

        // spies to track defered methods
        jest.spyOn(style, 'fire');
        jest.spyOn(style, '_reloadSource');
        jest.spyOn(style, '_updateWorkerLayers');

        style.addLayer({id: 'first', type: 'symbol', source: 'streets'});
        style.addLayer({id: 'second', type: 'symbol', source: 'streets'});
        style.addLayer({id: 'third', type: 'symbol', source: 'terrain'});

        style.setPaintProperty('first', 'text-color', 'black');
        style.setPaintProperty('first', 'text-halo-color', 'white');

        expect(style.fire.called).toBeFalsy();
        expect(style._reloadSource.called).toBeFalsy();
        expect(style._updateWorkerLayers.called).toBeFalsy();

        style.update({});

        expect(style.fire.args[0][0].type).toBe('data');

        // called per source
        expect(style._reloadSource.calledTwice).toBeTruthy();
        expect(style._reloadSource.calledWith('streets')).toBeTruthy();
        expect(style._reloadSource.calledWith('terrain')).toBeTruthy();

        // called once
        expect(style._updateWorkerLayers.calledOnce).toBeTruthy();

        done();
    });
});

describe('Style#query*Features', done => {

    // These tests only cover filter validation. Most tests for these methods
    // live in the integration tests.

    let style;
    let onError;
    let transform;

    t.beforeEach((callback) => {
        transform = new Transform();
        transform.resize(100, 100);
        style = new Style(new StubMap());
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

    test('querySourceFeatures emits an error on incorrect filter', done => {
        expect(style.querySourceFeatures([10, 100], {filter: 7}, transform)).toEqual([]);
        t.match(onError.args[0][0].error.message, /querySourceFeatures\.filter/);
        done();
    });

    test('queryRenderedFeatures emits an error on incorrect filter', done => {
        expect(style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 7}, transform)).toEqual([]);
        t.match(onError.args[0][0].error.message, /queryRenderedFeatures\.filter/);
        done();
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', done => {
        let errors = 0;
        t.stub(style, 'fire').callsFake((event) => {
            if (event.error) {
                console.log(event.error.message);
                errors++;
            }
        });
        style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 'invalidFilter', validate: false}, transform);
        expect(errors).toBe(0);
        done();
    });

    test('querySourceFeatures not raise validation errors if validation was disabled', done => {
        let errors = 0;
        t.stub(style, 'fire').callsFake((event) => {
            if (event.error) errors++;
        });
        style.querySourceFeatures([{x: 0, y: 0}], {filter: 'invalidFilter', validate: false}, transform);
        expect(errors).toBe(0);
        done();
    });

    done();
});

describe('Style#addSourceType', done => {
    const _types = {'existing' () {}};

    t.stub(Style, 'getSourceType').callsFake(name => _types[name]);
    t.stub(Style, 'setSourceType').callsFake((name, create) => {
        _types[name] = create;
    });

    test('adds factory function', done => {
        const style = new Style(new StubMap());
        const SourceType = function () {};

        // expect no call to load worker source
        style.dispatcher.broadcast = function (type) {
            if (type === 'loadWorkerSource') {
                t.fail();
            }
        };

        style.addSourceType('foo', SourceType, () => {
            expect(_types['foo']).toBe(SourceType);
            done();
        });
    });

    test('triggers workers to load worker source code', done => {
        const style = new Style(new StubMap());
        const SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'loadWorkerSource') {
                expect(_types['bar']).toBe(SourceType);
                expect(params.name).toBe('bar');
                expect(params.url).toBe('worker-source.js');
                done();
            }
        };

        style.addSourceType('bar', SourceType, (err) => { expect(err).toBeFalsy(); });
    });

    test('refuses to add new type over existing name', done => {
        const style = new Style(new StubMap());
        style.addSourceType('existing', () => {}, (err) => {
            expect(err).toBeTruthy();
            done();
        });
    });

    done();
});

describe('Style#hasTransitions', done => {
    test('returns false when the style is loading', done => {
        const style = new Style(new StubMap());
        expect(style.hasTransitions()).toBe(false);
        done();
    });

    test('returns true when a property is transitioning', done => {
        const style = new Style(new StubMap());
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
            style.update({transition: {duration: 300, delay: 0}});
            expect(style.hasTransitions()).toBe(true);
            done();
        });
    });

    test('returns false when a property is not transitioning', done => {
        const style = new Style(new StubMap());
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
            style.update({transition: {duration: 0, delay: 0}});
            expect(style.hasTransitions()).toBe(false);
            done();
        });
    });

    done();
});
