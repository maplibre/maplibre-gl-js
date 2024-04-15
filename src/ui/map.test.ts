import {Map, MapOptions} from './map';
import {createMap, beforeMapTest, sleep, createStyle, createStyleSource} from '../util/test/util';
import {LngLat} from '../geo/lng_lat';
import {Tile} from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {Event as EventedEvent, ErrorEvent} from '../util/evented';
import simulate from '../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../test/unit/lib/fixed';
import {GeoJSONSourceSpecification, LayerSpecification, SourceSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RequestTransformFunction} from '../util/request_manager';
import {extend} from '../util/util';
import {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import {IControl} from './control/control';
import {EvaluationParameters} from '../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';
import {CameraOptions} from './camera';
import {Terrain} from '../render/terrain';
import {mercatorZfromAltitude} from '../geo/mercator_coordinate';
import {Transform} from '../geo/transform';
import {StyleImageInterface} from '../style/style_image';
import {Style} from '../style/style';
import {MapSourceDataEvent} from './events';
import {config} from '../util/config';
import {MessageType} from '../util/actor_messages';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('Map', () => {

    test('version', () => {
        const map = createMap({interactive: true, style: null});

        expect(typeof map.version === 'string').toBeTruthy();

        // Semver regex: https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
        // Backslashes are doubled to escape them
        const regexp = new RegExp('^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+)?$');
        expect(regexp.test(map.version)).toBeTruthy();
    });

    test('constructor', () => {
        const map = createMap({interactive: true, style: null});
        expect(map.getContainer()).toBeTruthy();
        expect(map.getStyle()).toBeUndefined();
        expect(map.boxZoom.isEnabled()).toBeTruthy();
        expect(map.doubleClickZoom.isEnabled()).toBeTruthy();
        expect(map.dragPan.isEnabled()).toBeTruthy();
        expect(map.dragRotate.isEnabled()).toBeTruthy();
        expect(map.keyboard.isEnabled()).toBeTruthy();
        expect(map.scrollZoom.isEnabled()).toBeTruthy();
        expect(map.touchZoomRotate.isEnabled()).toBeTruthy();
        expect(() => {
            new Map({
                container: 'anElementIdWhichDoesNotExistInTheDocument'
            } as any as MapOptions);
        }).toThrow(
            new Error('Container \'anElementIdWhichDoesNotExistInTheDocument\' not found.')
        );
    });

    test('bad map-specific token breaks map', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        createMap();
        //t.error();
    });

    describe('disables handlers', () => {
        test('disables all handlers', () => {
            const map = createMap({interactive: false});

            expect(map.boxZoom.isEnabled()).toBeFalsy();
            expect(map.doubleClickZoom.isEnabled()).toBeFalsy();
            expect(map.dragPan.isEnabled()).toBeFalsy();
            expect(map.dragRotate.isEnabled()).toBeFalsy();
            expect(map.keyboard.isEnabled()).toBeFalsy();
            expect(map.scrollZoom.isEnabled()).toBeFalsy();
            expect(map.touchZoomRotate.isEnabled()).toBeFalsy();
        });

        const handlerNames = [
            'scrollZoom',
            'boxZoom',
            'dragRotate',
            'dragPan',
            'keyboard',
            'doubleClickZoom',
            'touchZoomRotate'
        ];
        handlerNames.forEach((handlerName) => {
            test(`disables "${handlerName}" handler`, () => {
                const options = {};
                options[handlerName] = false;
                const map = createMap(options);

                expect(map[handlerName].isEnabled()).toBeFalsy();

            });
        });

    });

    test('emits load event after a style is set', done => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);

        const fail = () => done('test failed');
        const pass = () => done();

        map.on('load', fail);

        setTimeout(() => {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

    });

    describe('#setTransformRequest', () => {
        test('returns self', () => {
            const transformRequest = (() => {}) as any as RequestTransformFunction;
            const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
            expect(map.setTransformRequest(transformRequest)).toBe(map);
            expect(map._requestManager._transformRequestFn).toBe(transformRequest);
        });

        test('can be called more than once', () => {
            const map = createMap();

            const transformRequest = (() => {}) as any as RequestTransformFunction;
            map.setTransformRequest(transformRequest);
            map.setTransformRequest(transformRequest);
        });
    });

    describe('#is_Loaded', () => {

        test('Map#isSourceLoaded', async () => {
            const style = createStyle();
            const map = createMap({style});

            await map.once('load');
            const promise = new Promise<void>((resolve) => {
                map.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'idle') {
                        expect(map.isSourceLoaded('geojson')).toBe(true);
                        resolve();
                    }
                });
            });
            map.addSource('geojson', createStyleSource());
            expect(map.isSourceLoaded('geojson')).toBe(false);
            await promise;
        });

        test('Map#isSourceLoaded (equivalent to event.isSourceLoaded)', async () => {
            const style = createStyle();
            const map = createMap({style});

            await map.once('load');
            const promise = new Promise<void>((resolve) => {
                map.on('data', (e: MapSourceDataEvent) => {
                    if (e.dataType === 'source' && 'source' in e) {
                        expect(map.isSourceLoaded('geojson')).toBe(e.isSourceLoaded);
                        if (e.sourceDataType === 'idle') {
                            resolve();
                        }
                    }
                });
            });
            map.addSource('geojson', createStyleSource());
            expect(map.isSourceLoaded('geojson')).toBe(false);
            await promise;
        });

        test('Map#isStyleLoaded', done => {
            const style = createStyle();
            const map = createMap({style});

            expect(map.isStyleLoaded()).toBe(false);
            map.on('load', () => {
                expect(map.isStyleLoaded()).toBe(true);
                done();
            });
        });

        test('Map#areTilesLoaded', done => {
            const style = createStyle();
            const map = createMap({style});
            expect(map.areTilesLoaded()).toBe(true);
            map.on('load', () => {
                const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
                map.addSource('geojson', createStyleSource());
                map.style.sourceCaches.geojson._tiles[fakeTileId.key] = new Tile(fakeTileId, undefined);
                expect(map.areTilesLoaded()).toBe(false);
                map.style.sourceCaches.geojson._tiles[fakeTileId.key].state = 'loaded';
                expect(map.areTilesLoaded()).toBe(true);
                done();
            });
        });
    });

    test('#moveLayer', async () => {
        const map = createMap({
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId1',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }, {
                    id: 'layerId2',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }]
            })
        });

        await map.once('render');
        map.moveLayer('layerId1', 'layerId2');
        expect(map.getLayer('layerId1').id).toBe('layerId1');
        expect(map.getLayer('layerId2').id).toBe('layerId2');
    });

    test('#getLayer', async () => {
        const layer = {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        };
        const map = createMap({
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [layer]
            })
        });

        await map.once('render');
        const mapLayer = map.getLayer('layerId');
        expect(mapLayer.id).toBe(layer.id);
        expect(mapLayer.type).toBe(layer.type);
        expect(mapLayer.source).toBe(layer.source);
    });

    describe('#getLayersOrder', () => {
        test('returns ids of layers in the correct order', done => {
            const map = createMap({
                style: extend(createStyle(), {
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
                })
            });

            map.on('style.load', () => {
                map.addLayer({
                    id: 'custom',
                    type: 'custom',
                    render() {}
                }, 'raster');
                expect(map.getLayersOrder()).toEqual(['custom', 'raster']);
                done();
            });
        });
    });

    test('#setMinZoom', () => {
        const map = createMap({zoom: 5});
        map.setMinZoom(3.5);
        map.setZoom(1);
        expect(map.getZoom()).toBe(3.5);
    });

    test('unset minZoom', () => {
        const map = createMap({minZoom: 5});
        map.setMinZoom(null);
        map.setZoom(1);
        expect(map.getZoom()).toBe(1);
    });

    test('#getMinZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMinZoom()).toBe(-2);
        map.setMinZoom(10);
        expect(map.getMinZoom()).toBe(10);
    });

    test('ignore minZooms over maxZoom', () => {
        const map = createMap({zoom: 2, maxZoom: 5});
        expect(() => {
            map.setMinZoom(6);
        }).toThrow();
        map.setZoom(0);
        expect(map.getZoom()).toBe(0);
    });

    test('#setMaxZoom', () => {
        const map = createMap({zoom: 0});
        map.setMaxZoom(3.5);
        map.setZoom(4);
        expect(map.getZoom()).toBe(3.5);
    });

    test('unset maxZoom', () => {
        const map = createMap({maxZoom: 5});
        map.setMaxZoom(null);
        map.setZoom(6);
        expect(map.getZoom()).toBe(6);
    });

    test('#getMaxZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMaxZoom()).toBe(22);
        map.setMaxZoom(10);
        expect(map.getMaxZoom()).toBe(10);
    });

    test('ignore maxZooms over minZoom', () => {
        const map = createMap({minZoom: 5});
        expect(() => {
            map.setMaxZoom(4);
        }).toThrow();
        map.setZoom(5);
        expect(map.getZoom()).toBe(5);
    });

    test('throw on maxZoom smaller than minZoom at init', () => {
        expect(() => {
            createMap({minZoom: 10, maxZoom: 5});
        }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
    });

    test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
        expect(() => {
            createMap({minZoom: 1, maxZoom: 0});
        }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
    });

    test('#setMinPitch', () => {
        const map = createMap({pitch: 20});
        map.setMinPitch(10);
        map.setPitch(0);
        expect(map.getPitch()).toBe(10);
    });

    test('unset minPitch', () => {
        const map = createMap({minPitch: 20});
        map.setMinPitch(null);
        map.setPitch(0);
        expect(map.getPitch()).toBe(0);
    });

    test('#getMinPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMinPitch()).toBe(0);
        map.setMinPitch(10);
        expect(map.getMinPitch()).toBe(10);
    });

    test('ignore minPitchs over maxPitch', () => {
        const map = createMap({pitch: 0, maxPitch: 10});
        expect(() => {
            map.setMinPitch(20);
        }).toThrow();
        map.setPitch(0);
        expect(map.getPitch()).toBe(0);
    });

    test('#setMaxPitch', () => {
        const map = createMap({pitch: 0});
        map.setMaxPitch(10);
        map.setPitch(20);
        expect(map.getPitch()).toBe(10);
    });

    test('unset maxPitch', () => {
        const map = createMap({maxPitch: 10});
        map.setMaxPitch(null);
        map.setPitch(20);
        expect(map.getPitch()).toBe(20);
    });

    test('#getMaxPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMaxPitch()).toBe(60);
        map.setMaxPitch(10);
        expect(map.getMaxPitch()).toBe(10);
    });

    test('ignore maxPitchs over minPitch', () => {
        const map = createMap({minPitch: 10});
        expect(() => {
            map.setMaxPitch(0);
        }).toThrow();
        map.setPitch(10);
        expect(map.getPitch()).toBe(10);
    });

    test('throw on maxPitch smaller than minPitch at init', () => {
        expect(() => {
            createMap({minPitch: 10, maxPitch: 5});
        }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
    });

    test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', () => {
        expect(() => {
            createMap({minPitch: 1, maxPitch: 0});
        }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
    });

    test('throw on maxPitch greater than valid maxPitch at init', () => {
        expect(() => {
            createMap({maxPitch: 90});
        }).toThrow(new Error('maxPitch must be less than or equal to 85'));
    });

    test('throw on minPitch less than valid minPitch at init', () => {
        expect(() => {
            createMap({minPitch: -10});
        }).toThrow(new Error('minPitch must be greater than or equal to 0'));
    });

    test('#remove', () => {
        const map = createMap();
        const spyWorkerPoolRelease = jest.spyOn(map.style.dispatcher.workerPool, 'release');
        expect(map.getContainer().childNodes).toHaveLength(2);
        map.remove();
        expect(spyWorkerPoolRelease).toHaveBeenCalledTimes(1);
        expect(map.getContainer().childNodes).toHaveLength(0);

        // Cleanup
        spyWorkerPoolRelease.mockClear();
    });

    test('#remove calls onRemove on added controls', () => {
        const map = createMap();
        const control = {
            onRemove: jest.fn(),
            onAdd(_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        expect(control.onRemove).toHaveBeenCalledTimes(1);
    });

    test('#remove calls onRemove on added controls before style is destroyed', done => {
        const map = createMap();
        let onRemoveCalled = 0;
        let style;
        const control = {
            onRemove(map) {
                onRemoveCalled++;
                expect(map.getStyle()).toEqual(style);
            },
            onAdd(_) {
                return window.document.createElement('div');
            }
        };

        map.addControl(control);

        map.on('style.load', () => {
            style = map.getStyle();
            map.remove();
            expect(onRemoveCalled).toBe(1);
            done();
        });
    });

    test('does not fire "webglcontextlost" after #remove has been called', done => {
        const map = createMap();
        const canvas = map.getCanvas();
        map.once('webglcontextlost', () => done('"webglcontextlost" fired after #remove has been called'));
        map.remove();
        // Dispatch the event manually because at the time of this writing, gl does not support
        // the WEBGL_lose_context extension.
        canvas.dispatchEvent(new window.Event('webglcontextlost'));
        done();
    });

    test('does not fire "webglcontextrestored" after #remove has been called', done => {
        const map = createMap();
        const canvas = map.getCanvas();

        map.once('webglcontextlost', () => {
            map.once('webglcontextrestored', () => done('"webglcontextrestored" fired after #remove has been called'));
            map.remove();
            canvas.dispatchEvent(new window.Event('webglcontextrestored'));
            done();
        });

        // Dispatch the event manually because at the time of this writing, gl does not support
        // the WEBGL_lose_context extension.
        canvas.dispatchEvent(new window.Event('webglcontextlost'));
    });

    test('#remove broadcasts removeMap to worker', () => {
        const map = createMap();
        const _broadcastSpyOn = jest.spyOn(map.style.dispatcher, 'broadcast');
        map.remove();
        expect(_broadcastSpyOn).toHaveBeenCalledWith(MessageType.removeMap, undefined);
    });

    test('#redraw', async () => {
        const map = createMap();

        await map.once('idle');
        const renderPromise = map.once('render');

        map.redraw();
        await renderPromise;
    });

    test('#addControl', () => {
        const map = createMap();
        const control = {
            onAdd(_) {
                expect(map).toBe(_);
                return window.document.createElement('div');
            }
        } as any as IControl;
        map.addControl(control);
        expect(map._controls[0]).toBe(control);
    });

    test('#removeControl errors on invalid arguments', () => {
        const map = createMap();
        const control = {} as any as IControl;
        const stub = jest.spyOn(console, 'error').mockImplementation(() => {});

        map.addControl(control);
        map.removeControl(control);
        expect(stub).toHaveBeenCalledTimes(2);

    });

    test('#removeControl', () => {
        const map = createMap();
        const control = {
            onAdd() {
                return window.document.createElement('div');
            },
            onRemove(_) {
                expect(map).toBe(_);
            }
        };
        map.addControl(control);
        map.removeControl(control);
        expect(map._controls).toHaveLength(0);

    });

    test('#hasControl', () => {
        const map = createMap();
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            }
        };

        const control = new Ctrl();
        expect(map.hasControl(control)).toBe(false);
        map.addControl(control);
        expect(map.hasControl(control)).toBe(true);
    });

    test('#project', () => {
        const map = createMap();
        expect(map.project([0, 0])).toEqual({x: 100, y: 100});
    });

    test('#unproject', () => {
        const map = createMap();
        expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: 0});
    });

    test('#listImages', done => {
        const map = createMap();

        map.on('load', () => {
            expect(map.listImages()).toHaveLength(0);

            map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

            const images = map.listImages();
            expect(images).toHaveLength(1);
            expect(images[0]).toBe('img');
            done();
        });
    });

    test('#listImages throws an error if called before "load"', () => {
        const map = createMap();
        expect(() => {
            map.listImages();
        }).toThrow(Error);
    });

    describe('#queryRenderedFeatures', () => {

        test('if no arguments provided', done => {
            createMap({}, (err, map) => {
                expect(err).toBeFalsy();
                const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures();

                const args = spy.mock.calls[0];
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: []});
                expect(output).toEqual([]);

                done();
            });
        });

        test('if only "geometry" provided', done => {
            createMap({}, (err, map) => {
                expect(err).toBeFalsy();
                const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

                const args = spy.mock.calls[0];
                expect(args[0]).toEqual([{x: 100, y: 100}]); // query geometry
                expect(args[1]).toEqual({availableImages: []}); // params
                expect(args[2]).toEqual(map.transform); // transform
                expect(output).toEqual([]);

                done();
            });
        });

        test('if only "params" provided', done => {
            createMap({}, (err, map) => {
                expect(err).toBeFalsy();
                const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = spy.mock.calls[0];
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: [], filter: ['all']});
                expect(output).toEqual([]);

                done();
            });
        });

        test('if both "geometry" and "params" provided', done => {
            createMap({}, (err, map) => {
                expect(err).toBeFalsy();
                const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = spy.mock.calls[0];
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: [], filter: ['all']});
                expect(output).toEqual([]);

                done();
            });
        });

        test('if "geometry" with unwrapped coords provided', done => {
            createMap({}, (err, map) => {
                expect(err).toBeFalsy();
                const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                expect(spy.mock.calls[0][0]).toEqual([{x: 612, y: 100}]);
                done();
            });
        });

        test('returns an empty array when no style is loaded', () => {
            const map = createMap({style: undefined});
            expect(map.queryRenderedFeatures()).toEqual([]);
        });

    });

    describe('#setLayoutProperty', () => {
        test('sets property', done => {
            const map = createMap({
                style: {
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
                    'layers': [{
                        'id': 'symbol',
                        'type': 'symbol',
                        'source': 'geojson',
                        'layout': {
                            'text-transform': 'uppercase'
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.style.dispatcher.broadcast = function (key, value: any) {
                    expect(key).toBe(MessageType.updateLayers);
                    expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
                    return Promise.resolve({} as any);
                };

                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
                map.style.update({} as EvaluationParameters);
                expect(map.getLayoutProperty('symbol', 'text-transform')).toBe('lowercase');
                done();
            });
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }).toThrow(Error);

        });

        test('fires an error if layer not found', done => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    expect(error.message).toMatch(/Cannot style non-existing layer "non-existant"./);
                    done();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        test('fires a data event', async () => {
            // background layers do not have a source
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {},
                    'layers': [{
                        'id': 'background',
                        'type': 'background',
                        'layout': {
                            'visibility': 'none'
                        }
                    }]
                }
            });

            await map.once('style.load');
            const dataPromise = map.once('data');
            map.setLayoutProperty('background', 'visibility', 'visible');
            const e = await dataPromise;
            expect(e.dataType).toBe('style');
        });

        test('sets visibility on background layer', done => {
            // background layers do not have a source
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {},
                    'layers': [{
                        'id': 'background',
                        'type': 'background',
                        'layout': {
                            'visibility': 'none'
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('background', 'visibility', 'visible');
                expect(map.getLayoutProperty('background', 'visibility')).toBe('visible');
                done();
            });
        });

        test('sets visibility on raster layer', done => {
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {
                        'maplibre-satellite': {
                            'type': 'raster',
                            'tiles': ['http://example.com/{z}/{x}/{y}.png']
                        }
                    },
                    'layers': [{
                        'id': 'satellite',
                        'type': 'raster',
                        'source': 'maplibre-satellite',
                        'layout': {
                            'visibility': 'none'
                        }
                    }]
                }
            });

            // Suppress errors because we're not loading tiles from a real URL.
            map.on('error', () => {});

            map.on('style.load', () => {
                map.setLayoutProperty('satellite', 'visibility', 'visible');
                expect(map.getLayoutProperty('satellite', 'visibility')).toBe('visible');
                done();
            });
        });

        test('sets visibility on video layer', done => {
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {
                        'drone': {
                            'type': 'video',
                            'urls': [],
                            'coordinates': [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    'layers': [{
                        'id': 'shore',
                        'type': 'raster',
                        'source': 'drone',
                        'layout': {
                            'visibility': 'none'
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('shore', 'visibility', 'visible');
                expect(map.getLayoutProperty('shore', 'visibility')).toBe('visible');
                done();
            });
        });

        test('sets visibility on image layer', done => {
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {
                        'image': {
                            'type': 'image',
                            'url': '',
                            'coordinates': [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    'layers': [{
                        'id': 'image',
                        'type': 'raster',
                        'source': 'image',
                        'layout': {
                            'visibility': 'none'
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('image', 'visibility', 'visible');
                expect(map.getLayoutProperty('image', 'visibility')).toBe('visible');
                done();
            });
        });

    });

    describe('#getLayoutProperty', () => {
        test('fires an error if layer not found', done => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    expect(error.message).toMatch(/Cannot get style of non-existing layer "non-existant"./);
                    done();
                });
                (map as any).getLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

    });

    describe('#setPaintProperty', () => {
        test('sets property', done => {
            const map = createMap({
                style: {
                    'version': 8,
                    'sources': {},
                    'layers': [{
                        'id': 'background',
                        'type': 'background'
                    }]
                }
            });

            map.on('style.load', () => {
                map.setPaintProperty('background', 'background-color', 'red');
                expect(map.getPaintProperty('background', 'background-color')).toBe('red');
                done();
            });
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setPaintProperty('background', 'background-color', 'red');
            }).toThrow(Error);

        });

        test('fires an error if layer not found', done => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    expect(error.message).toMatch(/Cannot style non-existing layer "non-existant"./);
                    done();
                });
                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });

    });

    describe('error event', () => {
        test('logs errors to console when it has NO listeners', () => {
            // to avoid seeing error in the console in Jest
            let stub = jest.spyOn(console, 'error').mockImplementation(() => {});
            const map = createMap();
            stub.mockReset();
            stub = jest.spyOn(console, 'error').mockImplementation(() => {});
            const error = new Error('test');
            map.fire(new ErrorEvent(error));
            expect(stub).toHaveBeenCalledTimes(1);
            expect(stub.mock.calls[0][0]).toBe(error);
        });

        test('calls listeners', done => {
            const map = createMap();
            const error = new Error('test');
            map.on('error', (event) => {
                expect(event.error).toBe(error);
                done();
            });
            map.fire(new ErrorEvent(error));
        });

    });

    test('render stabilizes', done => {
        const style = createStyle();
        style.sources.mapbox = {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        };
        style.layers.push({
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        });

        let timer;
        const map = createMap({style});
        map.on('render', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                map.off('render', undefined);
                map.on('render', () => {
                    done('test failed');
                });
                expect((map as any)._frameId).toBeFalsy();
                done();
            }, 100);
        });
    });

    test('no render after idle event', done => {
        const style = createStyle();
        const map = createMap({style});
        map.on('idle', () => {
            map.on('render', () => {
                done('test failed');
            });
            setTimeout(() => {
                done();
            }, 100);
        });
    });

    test('no render before style loaded', done => {
        server.respondWith('/styleUrl', JSON.stringify(createStyle()));
        const map = createMap({style: '/styleUrl'});

        jest.spyOn(map, 'triggerRepaint').mockImplementationOnce(() => {
            if (!map.style._loaded) {
                done('test failed');
            }
        });
        map.on('render', () => {
            if (map.style._loaded) {
                done();
            } else {
                done('test failed');
            }
        });

        // Force a update should not call triggerRepaint till style is loaded.
        // Once style is loaded, it will trigger the update.
        map._update();
        server.respond();
    });

    test('no idle event during move', async () => {
        const style = createStyle();
        const map = createMap({style, fadeDuration: 0});
        await map.once('idle');
        map.zoomTo(0.5, {duration: 100});
        expect(map.isMoving()).toBeTruthy();
        await map.once('idle');
        expect(map.isMoving()).toBeFalsy();
    });

    test('#removeLayer restores Map#loaded() to true', done => {
        const map = createMap({
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }]
            })
        });

        map.once('render', () => {
            map.removeLayer('layerId');
            map.on('render', () => {
                if (map.loaded()) {
                    map.remove();
                    done();
                }
            });
        });
    });

    test('stops camera animation on mousedown when interactive', () => {
        const map = createMap({interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toBe(false);

        map.remove();
    });

    test('continues camera animation on mousedown when non-interactive', () => {
        const map = createMap({interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toBe(true);

        map.remove();
    });

    test('stops camera animation on touchstart when interactive', () => {
        const map = createMap({interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer(), {touches: [{target: map.getCanvas(), clientX: 0, clientY: 0}]});
        expect(map.isEasing()).toBe(false);

        map.remove();
    });

    test('continues camera animation on touchstart when non-interactive', () => {
        const map = createMap({interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer());
        expect(map.isEasing()).toBe(true);

        map.remove();
    });

    test('continues camera animation on resize', () => {
        const map = createMap(),
            container = map.getContainer();

        map.flyTo({center: [200, 0], duration: 100});

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        expect(map.isMoving()).toBeTruthy();

    });

    test('map fires `styleimagemissing` for missing icons', async () => {
        const map = createMap();

        const id = 'missing-image';

        const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

        let called: string;
        map.on('styleimagemissing', e => {
            map.addImage(e.id, sampleImage);
            called = e.id;
        });

        expect(map.hasImage(id)).toBeFalsy();

        const generatedImage = await map.style.imageManager.getImages([id]);
        expect(generatedImage[id].data.width).toEqual(sampleImage.width);
        expect(generatedImage[id].data.height).toEqual(sampleImage.height);
        expect(generatedImage[id].data.data).toEqual(sampleImage.data);
        expect(called).toBe(id);
        expect(map.hasImage(id)).toBeTruthy();
    });

    test('map getImage matches addImage, uintArray', () => {
        const map = createMap();
        const id = 'add-get-uint';
        const inputImage = {width: 2, height: 1, data: new Uint8Array(8)};

        map.addImage(id, inputImage);
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(false);
    });

    test('map getImage matches addImage, uintClampedArray', () => {
        const map = createMap();
        const id = 'add-get-uint-clamped';
        const inputImage = {width: 1, height: 2, data: new Uint8ClampedArray(8)};

        map.addImage(id, inputImage);
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(false);
    });

    test('map getImage matches addImage, ImageData', () => {
        const map = createMap();
        const id = 'add-get-image-data';
        const inputImage = new ImageData(1, 3);

        map.addImage(id, inputImage);
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(false);
    });

    test('map getImage matches addImage, StyleImageInterface uint', () => {
        const map = createMap();
        const id = 'add-get-style-image-iface-uint';
        const inputImage: StyleImageInterface = {
            width: 3,
            height: 1,
            data: new Uint8Array(12)
        };

        map.addImage(id, inputImage);
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(false);
    });

    test('map getImage matches addImage, StyleImageInterface clamped', () => {
        const map = createMap();
        const id = 'add-get-style-image-iface-clamped';
        const inputImage: StyleImageInterface = {
            width: 4,
            height: 1,
            data: new Uint8ClampedArray(16)
        };

        map.addImage(id, inputImage);
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(false);
    });

    test('map getImage matches addImage, StyleImageInterface SDF', () => {
        const map = createMap();
        const id = 'add-get-style-image-iface-sdf';
        const inputImage: StyleImageInterface = {
            width: 5,
            height: 1,
            data: new Uint8Array(20)
        };

        map.addImage(id, inputImage, {sdf: true});
        expect(map.hasImage(id)).toBeTruthy();

        const gotImage = map.getImage(id);
        expect(gotImage.data.width).toEqual(inputImage.width);
        expect(gotImage.data.height).toEqual(inputImage.height);
        expect(gotImage.sdf).toBe(true);
    });

    test('map does not fire `styleimagemissing` for empty icon values', done => {
        const map = createMap();

        map.on('load', () => {
            map.on('idle', () => {
                done();
            });

            map.addSource('foo', {
                type: 'geojson',
                data: {type: 'Point', coordinates: [0, 0]}
            });
            map.addLayer({
                id: 'foo',
                type: 'symbol',
                source: 'foo',
                layout: {
                    'icon-image': ['case', true, '', '']
                }
            });

            map.on('styleimagemissing', ({id}) => {
                done(`styleimagemissing fired for value ${id}`);
            });
        });
    });

    describe('setPixelRatio', () => {
        test('resizes canvas', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 512});
            Object.defineProperty(container, 'clientHeight', {value: 512});
            const map = createMap({container, pixelRatio: 1});
            expect(map.getCanvas().width).toBe(512);
            expect(map.getCanvas().height).toBe(512);
            map.setPixelRatio(2);
            expect(map.getCanvas().width).toBe(1024);
            expect(map.getCanvas().height).toBe(1024);
        });

        test('resizes painter', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 512});
            Object.defineProperty(container, 'clientHeight', {value: 512});
            const map = createMap({container, pixelRatio: 1});
            expect(map.painter.pixelRatio).toBe(1);
            expect(map.painter.width).toBe(512);
            expect(map.painter.height).toBe(512);
            map.setPixelRatio(2);
            expect(map.painter.pixelRatio).toBe(2);
            expect(map.painter.width).toBe(1024);
            expect(map.painter.height).toBe(1024);
        });
    });

    describe('getPixelRatio', () => {
        test('returns the pixel ratio', () => {
            const map = createMap({pixelRatio: 1});
            expect(map.getPixelRatio()).toBe(1);
            map.setPixelRatio(2);
            expect(map.getPixelRatio()).toBe(2);
        });
    });

    test('pixel ratio defaults to devicePixelRatio', () => {
        const map = createMap();
        expect(map.getPixelRatio()).toBe(devicePixelRatio);
    });

    test('pixel ratio by default reflects devicePixelRatio changes', () => {
        global.devicePixelRatio = 0.25;
        const map = createMap();
        expect(map.getPixelRatio()).toBe(0.25);
        global.devicePixelRatio = 1;
        expect(map.getPixelRatio()).toBe(1);
    });

    test('canvas has the expected size', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 2});
        expect(map.getCanvas().width).toBe(1024);
        expect(map.getCanvas().height).toBe(1024);
    });

    test('painter has the expected size and pixel ratio', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 2});
        expect(map.painter.pixelRatio).toBe(2);
        expect(map.painter.width).toBe(1024);
        expect(map.painter.height).toBe(1024);
    });

    test('fires sourcedataabort event on dataabort event', async () => {
        const map = createMap();
        const sourcePromise = map.once('sourcedataabort');
        map.fire(new EventedEvent('dataabort'));
        await sourcePromise;
    });

    describe('#setTerrain', () => {
        test('warn when terrain and hillshade source identical', done => {
            server.respondWith('/source.json', JSON.stringify({
                minzoom: 5,
                maxzoom: 12,
                attribution: 'Terrain',
                tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
                bounds: [-47, -7, -45, -5]
            }));

            const map = createMap();

            map.on('load', () => {
                map.addSource('terrainrgb', {type: 'raster-dem', url: '/source.json'});
                server.respond();
                map.addLayer({id: 'hillshade', type: 'hillshade', source: 'terrainrgb'});
                const stub = jest.spyOn(console, 'warn').mockImplementation(() => { });
                stub.mockReset();
                map.setTerrain({
                    source: 'terrainrgb'
                });
                expect(console.warn).toHaveBeenCalledTimes(1);
                done();
            });
        });
    });

    describe('#getTerrain', () => {
        test('returns null when not set', () => {
            const map = createMap();
            expect(map.getTerrain()).toBeNull();
        });
    });

    describe('cooperativeGestures option', () => {
        test('cooperativeGesture container element is hidden from a11y tree', () => {
            const map = createMap({cooperativeGestures: true});
            expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen').getAttribute('aria-hidden')).toBeTruthy();
        });

        test('cooperativeGesture container element is not available when cooperativeGestures not initialized', () => {
            const map = createMap({cooperativeGestures: false});
            expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen')).toBeFalsy();
        });

        test('cooperativeGesture container element is not available when cooperativeGestures disabled', () => {
            const map = createMap({cooperativeGestures: true});
            map.cooperativeGestures.disable();
            expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen')).toBeFalsy();
        });
    });

    describe('getCameraTargetElevation', () => {
        test('Elevation is zero without terrain, and matches any given terrain', () => {
            const map = createMap();
            expect(map.getCameraTargetElevation()).toBe(0);

            const terrainStub = {} as Terrain;
            map.terrain = terrainStub;

            const transform = new Transform(0, 22, 0, 60, true);
            transform.elevation = 200;
            transform.center = new LngLat(10.0, 50.0);
            transform.zoom = 14;
            transform.resize(512, 512);
            transform.elevation = 2000;
            map.transform = transform;

            expect(map.getCameraTargetElevation()).toBe(2000);
        });
    });

    describe('#calculateCameraOptionsFromTo', () => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        test('pitch 90 with terrain', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_lngLat: LngLat, _zoom: number) => 111200);

            const terrainStub = {} as Terrain;
            terrainStub.getElevationForLngLatZoom = mockedGetElevation;
            map.terrain = terrainStub;

            // distance between lng x and lng x+1 is 111.2km at same lat
            // altitude same as center elevation => 90° pitch
            const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
            expect(cameraOptions).toBeDefined();
            expect(cameraOptions.pitch).toBeCloseTo(90);
            expect(mockedGetElevation.mock.calls).toHaveLength(1);
        });

        test('pitch 153.435 with terrain', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_lngLat: LngLat, _zoom: number) => 111200 * 3);

            const terrainStub = {} as Terrain;
            terrainStub.getElevationForLngLatZoom = mockedGetElevation;
            map.terrain = terrainStub;
            // distance between lng x and lng x+1 is 111.2km at same lat
            // (elevation difference of cam and center) / 2 = grounddistance =>
            // acos(111.2 / sqrt(111.2² + (111.2 * 2)²)) = acos(1/sqrt(5)) => 63.435 + 90 = 153.435
            const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(1, 0), 111200, new LngLat(0, 0));
            expect(cameraOptions).toBeDefined();
            expect(cameraOptions.pitch).toBeCloseTo(153.435);
            expect(mockedGetElevation.mock.calls).toHaveLength(1);
        });

        test('pitch 63 with terrain', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_lngLat: LngLat, _zoom: number) => 111200 / 2);

            const terrainStub = {} as Terrain;
            terrainStub.getElevationForLngLatZoom = mockedGetElevation;
            map.terrain = terrainStub;

            // distance between lng x and lng x+1 is 111.2km at same lat
            // (elevation difference of cam and center) * 2 = grounddistance =>
            // acos(111.2 / sqrt(111.2² + (111.2 * 0.5)²)) = acos(1/sqrt(1.25)) => 90 (looking down) - 26.565 = 63.435
            const cameraOptions: CameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 111200, new LngLat(1, 0));
            expect(cameraOptions).toBeDefined();
            expect(cameraOptions.pitch).toBeCloseTo(63.435);
            expect(mockedGetElevation.mock.calls).toHaveLength(1);
        });

        test('zoom distance 1000', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_lngLat: LngLat, _zoom: number) => 1000);

            const terrainStub = {} as Terrain;
            terrainStub.getElevationForLngLatZoom = mockedGetElevation;
            map.terrain = terrainStub;

            const expectedZoom = Math.log2(map.transform.cameraToCenterDistance / mercatorZfromAltitude(1000, 0) / map.transform.tileSize);
            const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0));

            expect(cameraOptions).toBeDefined();
            expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
            expect(mockedGetElevation.mock.calls).toHaveLength(1);
        });

        test('don\'t call getElevation when altitude supplied', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

            const terrainStub = {} as Terrain;
            terrainStub.getElevation = mockedGetElevation;
            map.terrain = terrainStub;

            const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(0, 0), 1000);

            expect(cameraOptions).toBeDefined();
            expect(mockedGetElevation.mock.calls).toHaveLength(0);
        });

        test('don\'t call getElevation when altitude 0 supplied', () => {
            const map = createMap();

            const mockedGetElevation = jest.fn((_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number) => 0);

            const terrainStub = {} as Terrain;
            terrainStub.getElevation = mockedGetElevation;
            map.terrain = terrainStub;

            const cameraOptions = map.calculateCameraOptionsFromTo(new LngLat(0, 0), 0, new LngLat(1, 0), 0);

            expect(cameraOptions).toBeDefined();
            expect(mockedGetElevation.mock.calls).toHaveLength(0);
        });
    });

    describe('webgl errors', () => {
        test('WebGL error while creating map', () => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type: string) {
                if (type === 'webgl2' || type === 'webgl') {
                    const errorEvent = new Event('webglcontextcreationerror');
                    (errorEvent as any).statusMessage = 'mocked webglcontextcreationerror message';
                    (this as HTMLCanvasElement).dispatchEvent(errorEvent);
                    return null;
                }
            };
            try {
                createMap();
            } catch (e) {
                const errorMessageObject = JSON.parse(e.message);

                // this message is from map code
                expect(errorMessageObject.message).toBe('Failed to initialize WebGL');

                // this is from test mock
                expect(errorMessageObject.statusMessage).toBe('mocked webglcontextcreationerror message');
            } finally {
                HTMLCanvasElement.prototype.getContext = original;
            }
        });
        test('Hit WebGL max drawing buffer limit', () => {
            // Simulate a device with MAX_TEXTURE_SIZE=16834 and max rendering area of ~32Mpx
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 8000});
            Object.defineProperty(container, 'clientHeight', {value: 4500});
            const map = createMap({container, maxCanvasSize: [16834, 16834], pixelRatio: 1});
            jest.spyOn(map.painter.context.gl, 'drawingBufferWidth', 'get').mockReturnValue(7536);
            jest.spyOn(map.painter.context.gl, 'drawingBufferHeight', 'get').mockReturnValue(4239);
            map.resize();
            expect(map.getCanvas().width).toBe(7536);
            expect(map.getCanvas().height).toBe(4239);
            // Check if maxCanvasSize is updated
            expect(map._maxCanvasSize).toEqual([7536, 4239]);
        });
    });

    describe('Max Canvas Size option', () => {
        test('maxCanvasSize width = height', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 2048});
            Object.defineProperty(container, 'clientHeight', {value: 2048});
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
            const map = createMap({container, maxCanvasSize: [8192, 8192], pixelRatio: 5});
            map.resize();
            expect(map.getCanvas().width).toBe(8192);
            expect(map.getCanvas().height).toBe(8192);
        });

        test('maxCanvasSize width != height', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 1024});
            Object.defineProperty(container, 'clientHeight', {value: 2048});
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(4096);
            const map = createMap({container, maxCanvasSize: [8192, 4096], pixelRatio: 3});
            map.resize();
            expect(map.getCanvas().width).toBe(2048);
            expect(map.getCanvas().height).toBe(4096);
        });

        test('maxCanvasSize below clientWidth and clientHeigth', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 12834});
            Object.defineProperty(container, 'clientHeight', {value: 9000});
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(4096);
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
            const map = createMap({container, maxCanvasSize: [4096, 8192], pixelRatio: 1});
            map.resize();
            expect(map.getCanvas().width).toBe(4096);
            expect(map.getCanvas().height).toBe(2872);
        });

        test('maxCanvasSize with setPixelRatio', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 2048});
            Object.defineProperty(container, 'clientHeight', {value: 2048});
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(3072);
            jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(3072);
            const map = createMap({container, maxCanvasSize: [3072, 3072], pixelRatio: 1.25});
            map.resize();
            expect(map.getCanvas().width).toBe(2560);
            expect(map.getCanvas().height).toBe(2560);
            map.setPixelRatio(2);
            expect(map.getCanvas().width).toBe(3072);
            expect(map.getCanvas().height).toBe(3072);
        });
    });

});
