import '../../stub_loader';
import {test} from '../../util/test';
import Style from '../../../rollup/build/tsc/src/style/style';
import SourceCache from '../../../rollup/build/tsc/src/source/source_cache';
import StyleLayer from '../../../rollup/build/tsc/src/style/style_layer';
import Transform from '../../../rollup/build/tsc/src/geo/transform';
import {extend} from '../../../rollup/build/tsc/src/util/util';
import {RequestManager} from '../../../rollup/build/tsc/src/util/request_manager';
import {Event, Evented} from '../../../rollup/build/tsc/src/util/evented';
import {
    setRTLTextPlugin,
    clearRTLTextPlugin,
    evented as rtlTextPluginEvented
} from '../../../rollup/build/tsc/src/source/rtl_text_plugin';
import browser from '../../../rollup/build/tsc/src/util/browser';
import {OverscaledTileID} from '../../../rollup/build/tsc/src/source/tile_id';

function createStyleJSON(properties) {
    return extend({
        "version": 8,
        "sources": {},
        "layers": []
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
        "type": "geojson",
        "data": {
            "type": "FeatureCollection",
            "features": []
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

test('Style', (t) => {
    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        window.clearFakeWorkerPresence();
        callback();
    });

    t.test('registers plugin state change listener', (t) => {
        clearRTLTextPlugin();
        window.useFakeXMLHttpRequest();
        window.useFakeWorkerPresence();
        t.spy(Style, 'registerForPluginStateChange');
        const style = new Style(new StubMap());
        t.spy(style.dispatcher, 'broadcast');
        expect(Style.registerForPluginStateChange.calledOnce).toBeTruthy();

        setRTLTextPlugin("/plugin.js",);
        expect(style.dispatcher.broadcast.calledWith('syncRTLPluginState', {
            pluginStatus: 'deferred',
            pluginURL: "/plugin.js"
        })).toBeTruthy();
        window.clearFakeWorkerPresence();
        t.end();
    });

    t.test('loads plugin immediately if already registered', (t) => {
        clearRTLTextPlugin();
        window.useFakeXMLHttpRequest();
        window.useFakeWorkerPresence();
        window.server.respondWith('/plugin.js', "doesn't matter");
        let firstError = true;
        setRTLTextPlugin("/plugin.js", (error) => {
            // Getting this error message shows the bogus URL was succesfully passed to the worker
            // We'll get the error from all workers, only pay attention to the first one
            if (firstError) {
                expect(error.message).toBe('RTL Text Plugin failed to import scripts from /plugin.js');
                t.end();
                window.clearFakeWorkerPresence();
                window.clearFakeXMLHttpRequest();
                firstError = false;
            }
        });
        window.server.respond();
        new Style(createStyleJSON());
    });

    t.end();
});

test('Style#loadURL', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    t.test('fires "dataloading"', (t) => {
        const style = new Style(new StubMap());
        const spy = t.spy();

        style.on('dataloading', spy);
        style.loadURL('style.json');

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0].target).toBe(style);
        expect(spy.getCall(0).args[0].dataType).toBe('style');
        t.end();
    });

    t.test('transforms style URL before request', (t) => {
        const map = new StubMap();
        const spy = t.spy(map._requestManager, 'transformRequest');

        const style = new Style(map);
        style.loadURL('style.json');

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0]).toBe('style.json');
        expect(spy.getCall(0).args[1]).toBe('Style');
        t.end();
    });

    t.test('validates the style', (t) => {
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            t.match(error.message, /version/);
            t.end();
        });

        style.loadURL('style.json');
        window.server.respondWith(JSON.stringify(createStyleJSON({version: 'invalid'})));
        window.server.respond();
    });

    t.test('cancels pending requests if removed', (t) => {
        const style = new Style(new StubMap());
        style.loadURL('style.json');
        style._remove();
        expect(window.server.lastRequest.aborted).toBe(true);
        t.end();
    });

    t.end();
});

test('Style#loadJSON', (t) => {
    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    t.test('fires "dataloading" (synchronously)', (t) => {
        const style = new Style(new StubMap());
        const spy = t.spy();

        style.on('dataloading', spy);
        style.loadJSON(createStyleJSON());

        expect(spy.calledOnce).toBeTruthy();
        expect(spy.getCall(0).args[0].target).toBe(style);
        expect(spy.getCall(0).args[0].dataType).toBe('style');
        t.end();
    });

    t.test('fires "data" (asynchronously)', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON());

        style.on('data', (e) => {
            expect(e.target).toBe(style);
            expect(e.dataType).toBe('style');
            t.end();
        });
    });

    t.test('fires "data" when the sprite finishes loading', (t) => {
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
            "version": 8,
            "sources": {},
            "layers": [],
            "sprite": "http://example.com/sprite"
        });

        style.once('error', (e) => expect(e).toBeFalsy());

        style.once('data', (e) => {
            expect(e.target).toBe(style);
            expect(e.dataType).toBe('style');

            style.once('data', (e) => {
                expect(e.target).toBe(style);
                expect(e.dataType).toBe('style');
                t.end();
            });

            respond();
        });
    });

    t.test('validates the style', (t) => {
        const style = new Style(new StubMap());

        style.on('error', ({error}) => {
            expect(error).toBeTruthy();
            t.match(error.message, /version/);
            t.end();
        });

        style.loadJSON(createStyleJSON({version: 'invalid'}));
    });

    t.test('creates sources', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            expect(style.sourceCaches['mapbox'] instanceof SourceCache).toBeTruthy();
            t.end();
        });

        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
    });

    t.test('creates layers', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            expect(style.getLayer('fill') instanceof StyleLayer).toBeTruthy();
            t.end();
        });

        style.loadJSON({
            "version": 8,
            "sources": {
                "foo": {
                    "type": "vector"
                }
            },
            "layers": [{
                "id": "fill",
                "source": "foo",
                "source-layer": "source-layer",
                "type": "fill"
            }]
        });
    });

    t.test('transforms sprite json and image URLs before request', (t) => {
        window.useFakeXMLHttpRequest();

        const map = new StubMap();
        const transformSpy = t.spy(map._requestManager, 'transformRequest');
        const style = new Style(map);

        style.on('style.load', () => {
            expect(transformSpy.callCount).toBe(2);
            expect(transformSpy.getCall(0).args[0]).toBe('http://example.com/sprites/bright-v8.json');
            expect(transformSpy.getCall(0).args[1]).toBe('SpriteJSON');
            expect(transformSpy.getCall(1).args[0]).toBe('http://example.com/sprites/bright-v8.png');
            expect(transformSpy.getCall(1).args[1]).toBe('SpriteImage');
            t.end();
        });

        style.loadJSON(extend(createStyleJSON(), {
            "sprite": "http://example.com/sprites/bright-v8"
        }));
    });

    t.test('emits an error on non-existant vector source layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                '-source-id-': {type: "vector", tiles: []}
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

            t.end();
        });
    });

    t.test('sets up layer event forwarding', (t) => {
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
            t.end();
        });

        style.on('style.load', () => {
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    t.end();
});

test('Style#_remove', (t) => {
    t.test('clears tiles', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            t.spy(sourceCache, 'clearTiles');
            style._remove();
            expect(sourceCache.clearTiles.calledOnce).toBeTruthy();
            t.end();
        });
    });

    t.test('deregisters plugin listener', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        t.spy(style.dispatcher, 'broadcast');

        style.on('style.load', () => {
            style._remove();

            rtlTextPluginEvented.fire(new Event('pluginStateChange'));
            expect(style.dispatcher.broadcast.calledWith('syncRTLPluginState')).toBeFalsy();
            t.end();
        });
    });

    t.end();
});

test('Style#update', (t) => {
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
            t.end();
        };

        style.update({});
    });
});

test('Style#setState', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.setState(createStyleJSON())).toThrowError(/load/i);
        t.end();
    });

    t.test('do nothing if there are no changes', (t) => {
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
            t.end();
        });
    });

    t.test('Issue #3893: compare new source options against originally provided options rather than normalized properties', (t) => {
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
            t.end();
        });
        window.server.respond();
    });

    t.test('return true if there is a change', (t) => {
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
            t.end();
        });
    });

    t.test('sets GeoJSON source data if different', (t) => {
        const initialState = createStyleJSON({
            "sources": {"source-id": createGeoJSONSource()}
        });

        const geoJSONSourceData = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [125.6, 10.1]
                    }
                }
            ]
        };

        const nextState = createStyleJSON({
            "sources": {
                "source-id": {
                    "type": "geojson",
                    "data": geoJSONSourceData
                }
            }
        });

        const style = new Style(new StubMap());
        style.loadJSON(initialState);

        style.on('style.load', () => {
            const geoJSONSource = style.sourceCaches['source-id'].getSource();
            t.spy(style, 'setGeoJSONSourceData');
            t.spy(geoJSONSource, 'setData');
            const didChange = style.setState(nextState);

            expect(style.setGeoJSONSourceData.calledWith('source-id', geoJSONSourceData)).toBeTruthy();
            expect(geoJSONSource.setData.calledWith(geoJSONSourceData)).toBeTruthy();
            expect(didChange).toBeTruthy();
            expect(style.stylesheet).toEqual(nextState);
            t.end();
        });
    });

    t.end();
});

test('Style#addSource', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.addSource('source-id', createSource())).toThrowError(/load/i);
        t.end();
    });

    t.test('throw if missing source type', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        const source = createSource();
        delete source.type;

        style.on('style.load', () => {
            expect(() => style.addSource('source-id', source)).toThrowError(/type/i);
            t.end();
        });
    });

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.once('data', t.end);
        style.on('style.load', () => {
            style.addSource('source-id', source);
            style.update({});
        });
    });

    t.test('throws on duplicates', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const source = createSource();
        style.on('style.load', () => {
            style.addSource('source-id', source);
            expect(() => {
                style.addSource('source-id', source);
            }).toThrowError(/Source "source-id" already exists./);
            t.end();
        });
    });

    t.test('emits on invalid source', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.sourceCaches['source-id']).toBeFalsy();
                t.end();
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

    t.test('sets up source event forwarding', (t) => {
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

    t.end();
});

test('Style#removeSource', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.removeSource('source-id')).toThrowError(/load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
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

    t.test('clears tiles', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {'source-id': createGeoJSONSource()}
        }));

        style.on('style.load', () => {
            const sourceCache = style.sourceCaches['source-id'];
            t.spy(sourceCache, 'clearTiles');
            style.removeSource('source-id');
            expect(sourceCache.clearTiles.calledOnce).toBeTruthy();
            t.end();
        });
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => {
                style.removeSource('source-id');
            }).toThrowError(/There is no source with this ID/);
            t.end();
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

    t.test('throws if source is in use', (t) => {
        createStyle((style) => {
            style.on('error', (event) => {
                expect(event.error.message.includes('"mapbox-source"')).toBeTruthy();
                expect(event.error.message.includes('"mapbox-layer"')).toBeTruthy();
                t.end();
            });
            style.removeSource('mapbox-source');
        });
    });

    t.test('does not throw if source is not in use', (t) => {
        createStyle((style) => {
            style.on('error', () => {
                t.fail();
            });
            style.removeLayer('mapbox-layer');
            style.removeSource('mapbox-source');
            t.end();
        });
    });

    t.test('tears down source event forwarding', (t) => {
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

            t.end();
        });
    });

    t.end();
});

test('Style#setGeoJSONSourceData', (t) => {
    const geoJSON = {type: "FeatureCollection", features: []};

    t.test('throws before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrowError(/load/i);
        t.end();
    });

    t.test('throws on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            expect(() => style.setGeoJSONSourceData('source-id', geoJSON)).toThrowError(/There is no source with this ID/);
            t.end();
        });
    });

    t.end();
});

test('Style#addLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.addLayer({id: 'background', type: 'background'})).toThrowError(/load/i);
        t.end();
    });

    t.test('sets up layer event forwarding', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('error', (e) => {
            expect(e.layer).toEqual({id: 'background'});
            expect(e.mapbox).toBeTruthy();
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer({
                id: 'background',
                type: 'background'
            });
            style._layers.background.fire(new Event('error', {mapbox: true}));
        });
    });

    t.test('throws on non-existant vector source layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON({
            sources: {
                // At least one source must be added to trigger the load event
                dummy: {type: "vector", tiles: []}
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

            t.end();
        });
    });

    t.test('emits error on invalid layer', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.getLayer('background')).toBeFalsy();
                t.end();
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

    t.test('#4040 does not mutate source property when provided inline', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        style.on('style.load', () => {
            const source = {
                "type": "geojson",
                "data": {
                    "type": "Point",
                    "coordinates": [ 0, 0]
                }
            };
            const layer = {id: 'inline-source-layer', type: 'circle', source};
            style.addLayer(layer);
            expect(layer.source).toEqual(source);
            t.end();
        });
    });

    t.test('reloads source', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            }
        }));
        const layer = {
            "id": "symbol",
            "type": "symbol",
            "source": "mapbox",
            "source-layer": "boxmap",
            "filter": ["==", "id", 0]
        };

        style.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                style.sourceCaches['mapbox'].reload = t.end;
                style.addLayer(layer);
                style.update({});
            }
        });
    });

    t.test('#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            },
            layers: [{
                "id": "my-layer",
                "type": "symbol",
                "source": "mapbox",
                "source-layer": "boxmap",
                "filter": ["==", "id", 0]
            }]
        }));

        const layer = {
            "id": "my-layer",
            "type": "symbol",
            "source": "mapbox",
            "source-layer": "boxmap"
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

    t.test('clears source (instead of reloading) if adding this layer with a different type, immediately after removing it', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "mapbox": {
                    "type": "vector",
                    "tiles": []
                }
            },
            layers: [{
                "id": "my-layer",
                "type": "symbol",
                "source": "mapbox",
                "source-layer": "boxmap",
                "filter": ["==", "id", 0]
            }]
        }));

        const layer = {
            "id": "my-layer",
            "type": "circle",
            "source": "mapbox",
            "source-layer": "boxmap"
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

    t.test('fires "data" event', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.once('data', t.end);

        style.on('style.load', () => {
            style.addLayer(layer);
            style.update({});
        });
    });

    t.test('emits error on duplicates', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());
        const layer = {id: 'background', type: 'background'};

        style.on('error', (e) => {
            t.match(e.error, /already exists/);
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer(layer);
            style.addLayer(layer);
        });
    });

    t.test('adds to the end by default', (t) => {
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
            t.end();
        });
    });

    t.test('adds before the given layer', (t) => {
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
            t.end();
        });
    });

    t.test('fire error if before layer does not exist', (t) => {
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
                t.end();
            });
            style.addLayer(layer, 'z');
        });
    });

    t.test('fires an error on non-existant source layer', (t) => {
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
                t.end();
            });
            style.addLayer(layer);
        });

    });

    t.end();
});

test('Style#removeLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.removeLayer('background')).toThrowError(/load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
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

    t.test('tears down layer event forwarding', (t) => {
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
            t.end();
        });
    });

    t.test('fires an error on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot remove non-existing layer "background"./);
                t.end();
            });
            style.removeLayer('background');
        });
    });

    t.test('removes from the order', (t) => {
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
            t.end();
        });
    });

    t.test('does not remove dereffed layers', (t) => {
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
            expect(style.getLayer('a')).toBe(undefined);
            expect(style.getLayer('b')).not.toBe(undefined);
            t.end();
        });
    });

    t.end();
});

test('Style#moveLayer', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.moveLayer('background')).toThrowError(/load/i);
        t.end();
    });

    t.test('fires "data" event', (t) => {
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

    t.test('fires an error on non-existence', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(createStyleJSON());

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /does not exist in the map\'s style and cannot be moved/);
                t.end();
            });
            style.moveLayer('background');
        });
    });

    t.test('changes the order', (t) => {
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
            t.end();
        });
    });

    t.test('moves to existing location', (t) => {
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
            t.end();
        });
    });

    t.end();
});

test('Style#setPaintProperty', (t) => {
    t.test('#4738 postpones source reload until layers have been broadcast to workers', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON(extend(createStyleJSON(), {
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {"type": "FeatureCollection", "features": []}
                }
            },
            "layers": [
                {
                    "id": "circle",
                    "type": "circle",
                    "source": "geojson"
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
                        t.end();
                    });

                    source.setData({"type": "FeatureCollection", "features": []});
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

    t.test('#5802 clones the input', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [
                {
                    "id": "background",
                    "type": "background"
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

            t.end();
        });
    });

    t.test('respects validate option', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [
                {
                    "id": "background",
                    "type": "background"
                }
            ]
        });

        style.on('style.load', () => {
            const backgroundLayer = style.getLayer('background');
            t.stub(console, 'error');
            const validate = t.spy(backgroundLayer, '_validate');

            style.setPaintProperty('background', 'background-color', 'notacolor', {validate: false});
            expect(validate.args[0][4]).toEqual({validate: false});
            expect(console.error.notCalled).toBeTruthy();

            expect(style._changed).toBeTruthy();
            style.update({});

            style.setPaintProperty('background', 'background-color', 'alsonotacolor');
            expect(console.error.calledOnce).toBeTruthy();
            expect(validate.args[1][4]).toEqual({});

            t.end();
        });
    });

    t.end();
});

test('Style#getPaintProperty', (t) => {
    t.test('#5802 clones the output', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [
                {
                    "id": "background",
                    "type": "background"
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

            t.end();
        });
    });

    t.end();
});

test('Style#setLayoutProperty', (t) => {
    t.test('#5802 clones the input', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
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

            t.end();
        });
    });

    t.test('respects validate option', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
                }
            ]
        });

        style.on('style.load', () => {
            const lineLayer = style.getLayer('line');
            t.stub(console, 'error');
            const validate = t.spy(lineLayer, '_validate');

            style.setLayoutProperty('line', 'line-cap', 'invalidcap', {validate: false});
            expect(validate.args[0][4]).toEqual({validate: false});
            expect(console.error.notCalled).toBeTruthy();
            expect(style._changed).toBeTruthy();
            style.update({});

            style.setLayoutProperty('line', 'line-cap', 'differentinvalidcap');
            expect(console.error.calledOnce).toBeTruthy();
            expect(validate.args[1][4]).toEqual({});

            t.end();
        });
    });

    t.end();
});

test('Style#getLayoutProperty', (t) => {
    t.test('#5802 clones the output', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": {
                    "type": "geojson",
                    "data": {
                        "type": "FeatureCollection",
                        "features": []
                    }
                }
            },
            "layers": [
                {
                    "id": "line",
                    "type": "line",
                    "source": "geojson"
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

            t.end();
        });
    });

    t.end();
});

test('Style#setFilter', (t) => {
    t.test('throws if style is not loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.setFilter('symbol', ['==', 'id', 1])).toThrowError(/load/i);
        t.end();
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

    t.test('sets filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toEqual('symbol');
                expect(value.layers[0].filter).toEqual(['==', 'id', 1]);
                t.end();
            };

            style.setFilter('symbol', ['==', 'id', 1]);
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 1]);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    t.test('gets a clone of the filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter1 = ['==', 'id', 1];
            style.setFilter('symbol', filter1);
            const filter2 = style.getFilter('symbol');
            const filter3 = style.getLayer('symbol').filter;

            expect(filter1).not.toBe(filter2);
            expect(filter1).not.toBe(filter3);
            expect(filter2).not.toBe(filter3);

            t.end();
        });
    });

    t.test('sets again mutated filter', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            const filter = ['==', 'id', 1];
            style.setFilter('symbol', filter);
            style.update({}); // flush pending operations

            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toEqual('symbol');
                expect(value.layers[0].filter).toEqual(['==', 'id', 2]);
                t.end();
            };
            filter[2] = 2;
            style.setFilter('symbol', filter);
            style.update({}); // trigger dispatcher broadcast
        });
    });

    t.test('unsets filter', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.setFilter('symbol', null);
            expect(style.getLayer('symbol').serialize().filter).toBe(undefined);
            t.end();
        });
    });

    t.test('emits if invalid', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', () => {
                expect(style.getLayer('symbol').serialize().filter).toEqual(['==', 'id', 0]);
                t.end();
            });
            style.setFilter('symbol', ['==', '$type', 1]);
        });
    });

    t.test('fires an error if layer not found', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot filter non-existing layer "non-existant"./);
                t.end();
            });
            style.setFilter('non-existant', ['==', 'id', 1]);
        });
    });

    t.test('validates filter by default', (t) => {
        const style = createStyle();
        t.stub(console, 'error');
        style.on('style.load', () => {
            style.setFilter('symbol', 'notafilter');
            expect(style.getFilter('symbol')).toEqual(['==', 'id', 0]);
            expect(console.error.calledOnce).toBeTruthy();
            style.update({}); // trigger dispatcher broadcast
            t.end();
        });
    });

    t.test('respects validate option', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.layers[0].id).toEqual('symbol');
                expect(value.layers[0].filter).toEqual('notafilter');
                t.end();
            };

            style.setFilter('symbol', 'notafilter', {validate: false});
            expect(style.getFilter('symbol')).toEqual('notafilter');
            style.update({}); // trigger dispatcher broadcast
        });
    });

    t.end();
});

test('Style#setLayerZoomRange', (t) => {
    t.test('throw before loaded', (t) => {
        const style = new Style(new StubMap());
        expect(() => style.setLayerZoomRange('symbol', 5, 12)).toThrowError(/load/i);
        t.end();
    });

    function createStyle() {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }]
        });
        return style;
    }

    t.test('sets zoom range', (t) => {
        const style = createStyle();

        style.on('style.load', () => {
            style.dispatcher.broadcast = function(key, value) {
                expect(key).toBe('updateLayers');
                expect(value.map((layer) => { return layer.id; })).toEqual(['symbol']);
            };

            style.setLayerZoomRange('symbol', 5, 12);
            expect(style.getLayer('symbol').minzoom).toBe(5);
            expect(style.getLayer('symbol').maxzoom).toBe(12);
            t.end();
        });
    });

    t.test('fires an error if layer not found', (t) => {
        const style = createStyle();
        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /Cannot set the zoom range of non-existing layer "non-existant"./);
                t.end();
            });
            style.setLayerZoomRange('non-existant', 5, 12);
        });
    });

    t.test('does not reload raster source', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {
                "raster": {
                    type: "raster",
                    tiles: ['http://tiles.server']
                }
            },
            "layers": [{
                "id": "raster",
                "type": "raster",
                "source": "raster"
            }]
        });

        style.on('style.load', () => {
            t.spy(style, '_reloadSource');

            style.setLayerZoomRange('raster', 5, 12);
            style.update(0);
            expect(style._reloadSource.called).toBeFalsy();
            t.end();
        });
    });

    t.end();
});

test('Style#queryRenderedFeatures', (t) => {
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
        "version": 8,
        "sources": {
            "mapbox": {
                "type": "geojson",
                "data": {type: "FeatureCollection", features: []}
            },
            "other": {
                "type": "geojson",
                "data": {type: "FeatureCollection", features: []}
            }
        },
        "layers": [{
            "id": "land",
            "type": "line",
            "source": "mapbox",
            "source-layer": "water",
            "layout": {
                'line-cap': 'round'
            },
            "paint": {
                "line-color": "red"
            },
            "metadata": {
                "something": "else"
            }
        }, {
            "id": "landref",
            "ref": "land",
            "paint": {
                "line-color": "blue"
            }
        }, {
            "id": "land--other",
            "type": "line",
            "source": "other",
            "source-layer": "water",
            "layout": {
                'line-cap': 'round'
            },
            "paint": {
                "line-color": "red"
            },
            "metadata": {
                "something": "else"
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

        t.test('returns feature type', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            expect(results[0].geometry.type).toBe('Line');
            t.end();
        });

        t.test('filters by `layers` option', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land']}, transform);
            expect(results.length).toBe(2);
            t.end();
        });

        t.test('checks type of `layers` option', (t) => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('parameters.layers must be an Array.')) errors++;
            });
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers:'string'}, transform);
            expect(errors).toBe(1);
            t.end();
        });

        t.test('includes layout properties', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            const layout = results[0].layer.layout;
            expect(layout['line-cap']).toEqual('round');
            t.end();
        });

        t.test('includes paint properties', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);
            expect(results[2].layer.paint['line-color']).toEqual('red');
            t.end();
        });

        t.test('includes metadata', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {}, transform);

            const layer = results[1].layer;
            expect(layer.metadata.something).toBe('else');

            t.end();
        });

        t.test('include multiple layers', (t) => {
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land', 'landref']}, transform);
            expect(results.length).toBe(3);
            t.end();
        });

        t.test('does not query sources not implicated by `layers` parameter', (t) => {
            style.sourceCaches.mapbox.queryRenderedFeatures = function() { t.fail(); };
            style.queryRenderedFeatures([{x: 0, y: 0}], {layers: ['land--other']}, transform);
            t.end();
        });

        t.test('fires an error if layer included in params does not exist on the style', (t) => {
            let errors = 0;
            t.stub(style, 'fire').callsFake((event) => {
                if (event.error && event.error.message.includes('does not exist in the map\'s style and cannot be queried for features.')) errors++;
            });
            const results = style.queryRenderedFeatures([{x: 0, y: 0}], {layers:['merp']}, transform);
            expect(errors).toBe(1);
            expect(results.length).toBe(0);
            t.end();
        });

        t.end();
    });
});

test('Style defers expensive methods', (t) => {
    const style = new Style(new StubMap());
    style.loadJSON(createStyleJSON({
        "sources": {
            "streets": createGeoJSONSource(),
            "terrain": createGeoJSONSource()
        }
    }));

    style.on('style.load', () => {
        style.update({});

        // spies to track defered methods
        t.spy(style, 'fire');
        t.spy(style, '_reloadSource');
        t.spy(style, '_updateWorkerLayers');

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

        t.end();
    });
});

test('Style#query*Features', (t) => {

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
            "version": 8,
            "sources": {
                "geojson": createGeoJSONSource()
            },
            "layers": [{
                "id": "symbol",
                "type": "symbol",
                "source": "geojson"
            }]
        });

        onError = t.spy();

        style.on('error', onError)
            .on('style.load', () => {
                callback();
            });
    });

    t.test('querySourceFeatures emits an error on incorrect filter', (t) => {
        expect(style.querySourceFeatures([10, 100], {filter: 7}, transform)).toEqual([]);
        t.match(onError.args[0][0].error.message, /querySourceFeatures\.filter/);
        t.end();
    });

    t.test('queryRenderedFeatures emits an error on incorrect filter', (t) => {
        expect(style.queryRenderedFeatures([{x: 0, y: 0}], {filter: 7}, transform)).toEqual([]);
        t.match(onError.args[0][0].error.message, /queryRenderedFeatures\.filter/);
        t.end();
    });

    t.test('querySourceFeatures not raise validation errors if validation was disabled', (t) => {
        let errors = 0;
        t.stub(style, 'fire').callsFake((event) => {
            if (event.error) {
                console.log(event.error.message);
                errors++;
            }
        });
        style.queryRenderedFeatures([{x: 0, y: 0}], {filter: "invalidFilter", validate: false}, transform);
        expect(errors).toBe(0);
        t.end();
    });

    t.test('querySourceFeatures not raise validation errors if validation was disabled', (t) => {
        let errors = 0;
        t.stub(style, 'fire').callsFake((event) => {
            if (event.error) errors++;
        });
        style.querySourceFeatures([{x: 0, y: 0}], {filter: "invalidFilter", validate: false}, transform);
        expect(errors).toBe(0);
        t.end();
    });

    t.end();
});

test('Style#addSourceType', (t) => {
    const _types = {'existing' () {}};

    t.stub(Style, 'getSourceType').callsFake(name => _types[name]);
    t.stub(Style, 'setSourceType').callsFake((name, create) => {
        _types[name] = create;
    });

    t.test('adds factory function', (t) => {
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
            t.end();
        });
    });

    t.test('triggers workers to load worker source code', (t) => {
        const style = new Style(new StubMap());
        const SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        style.dispatcher.broadcast = function (type, params) {
            if (type === 'loadWorkerSource') {
                expect(_types['bar']).toBe(SourceType);
                expect(params.name).toBe('bar');
                expect(params.url).toBe('worker-source.js');
                t.end();
            }
        };

        style.addSourceType('bar', SourceType, (err) => { expect(err).toBeFalsy(); });
    });

    t.test('refuses to add new type over existing name', (t) => {
        const style = new Style(new StubMap());
        style.addSourceType('existing', () => {}, (err) => {
            expect(err).toBeTruthy();
            t.end();
        });
    });

    t.end();
});

test('Style#hasTransitions', (t) => {
    t.test('returns false when the style is loading', (t) => {
        const style = new Style(new StubMap());
        expect(style.hasTransitions()).toBe(false);
        t.end();
    });

    t.test('returns true when a property is transitioning', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty("background", "background-color", "blue");
            style.update({transition: {duration: 300, delay: 0}});
            expect(style.hasTransitions()).toBe(true);
            t.end();
        });
    });

    t.test('returns false when a property is not transitioning', (t) => {
        const style = new Style(new StubMap());
        style.loadJSON({
            "version": 8,
            "sources": {},
            "layers": [{
                "id": "background",
                "type": "background"
            }]
        });

        style.on('style.load', () => {
            style.setPaintProperty("background", "background-color", "blue");
            style.update({transition: {duration: 0, delay: 0}});
            expect(style.hasTransitions()).toBe(false);
            t.end();
        });
    });

    t.end();
});
