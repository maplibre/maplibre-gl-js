import {Map, MapOptions} from './map';
import {createMap, setErrorWebGlContext, beforeMapTest} from '../util/test/util';
import {LngLat} from '../geo/lng_lat';
import {Tile} from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {Event, ErrorEvent} from '../util/evented';
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

function createStyleSource() {
    return {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    } as SourceSpecification;
}

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

    test('initial bounds in constructor options', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});

        const bounds = [[-133, 16], [-68, 50]];
        const map = createMap({container, bounds});

        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(map.getZoom(), 3)).toBe(2.113);
    });

    test('initial bounds options in constructor options', () => {
        const bounds = [[-133, 16], [-68, 50]];

        const map = (fitBoundsOptions) => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'offsetWidth', {value: 512});
            Object.defineProperty(container, 'offsetHeight', {value: 512});
            return createMap({container, bounds, fitBoundsOptions});
        };

        const unpadded = map(undefined);
        const padded = map({padding: 100});

        expect(unpadded.getZoom() > padded.getZoom()).toBeTruthy();
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

    describe('#mapOptions', () => {
        test('maxTileCacheZoomLevels: Default value is set', () => {
            const map = createMap();
            expect(map._maxTileCacheZoomLevels).toBe(config.MAX_TILE_CACHE_ZOOM_LEVELS);
        });

        test('maxTileCacheZoomLevels: Value can be set via map options', () => {
            const map = createMap({maxTileCacheZoomLevels: 1});
            expect(map._maxTileCacheZoomLevels).toBe(1);
        });

        test('Style validation is enabled by default', () => {
            let validationOption = false;
            jest.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
                validationOption = options.validate;
            });
            createMap();
            expect(validationOption).toBeTruthy();
        });

        test('Style validation disabled using mapOptions', () => {
            let validationOption = true;
            jest.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
                validationOption = options.validate;
            });
            createMap({validateStyle: false});

            expect(validationOption).toBeFalsy();
        });

        test('fadeDuration is set after first idle event', async () => {
            let idleTriggered = false;
            const fadeDuration = 100;
            const spy = jest.spyOn(Style.prototype, 'update').mockImplementation((parameters: EvaluationParameters) => {
                if (!idleTriggered) {
                    expect(parameters.fadeDuration).toBe(0);
                } else {
                    expect(parameters.fadeDuration).toBe(fadeDuration);
                }
            });
            const style = createStyle();
            const map = createMap({style, fadeDuration});
            await map.once('idle');
            idleTriggered = true;
            map.zoomTo(0.5, {duration: 100});
            spy.mockReset();
        });
    });

    describe('#setStyle', () => {
        test('returns self', () => {
            const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
            expect(map.setStyle({
                version: 8,
                sources: {},
                layers: []
            })).toBe(map);
        });

        test('sets up event forwarding', () => {
            createMap({}, (error, map) => {
                expect(error).toBeFalsy();

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('error', recordEvent);
                map.on('data', recordEvent);
                map.on('dataloading', recordEvent);

                map.style.fire(new Event('error'));
                map.style.fire(new Event('data'));
                map.style.fire(new Event('dataloading'));

                expect(events).toEqual([
                    'error',
                    'data',
                    'dataloading',
                ]);

            });
        });

        test('fires *data and *dataloading events', () => {
            createMap({}, (error, map) => {
                expect(error).toBeFalsy();

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('styledata', recordEvent);
                map.on('styledataloading', recordEvent);
                map.on('sourcedata', recordEvent);
                map.on('sourcedataloading', recordEvent);
                map.on('tiledata', recordEvent);
                map.on('tiledataloading', recordEvent);

                map.style.fire(new Event('data', {dataType: 'style'}));
                map.style.fire(new Event('dataloading', {dataType: 'style'}));
                map.style.fire(new Event('data', {dataType: 'source'}));
                map.style.fire(new Event('dataloading', {dataType: 'source'}));
                map.style.fire(new Event('data', {dataType: 'tile'}));
                map.style.fire(new Event('dataloading', {dataType: 'tile'}));

                expect(events).toEqual([
                    'styledata',
                    'styledataloading',
                    'sourcedata',
                    'sourcedataloading',
                    'tiledata',
                    'tiledataloading'
                ]);

            });
        });

        test('can be called more than once', () => {
            const map = createMap();

            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});

        });

        test('style transform overrides unmodified map transform', done => {
            const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
            map.transform.lngRange = [-120, 140];
            map.transform.latRange = [-60, 80];
            map.transform.resize(600, 400);
            expect(map.transform.zoom).toBe(0.6983039737971014);
            expect(map.transform.unmodified).toBeTruthy();
            map.setStyle(createStyle());
            map.on('style.load', () => {
                expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -73.9749, lat: 40.7736}));
                expect(fixedNum(map.transform.zoom)).toBe(12.5);
                expect(fixedNum(map.transform.bearing)).toBe(29);
                expect(fixedNum(map.transform.pitch)).toBe(50);
                done();
            });
        });

        test('style transform does not override map transform modified via options', done => {
            const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888]} as any as MapOptions);
            expect(map.transform.unmodified).toBeFalsy();
            map.setStyle(createStyle());
            map.on('style.load', () => {
                expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
                expect(fixedNum(map.transform.zoom)).toBe(10);
                expect(fixedNum(map.transform.bearing)).toBe(0);
                expect(fixedNum(map.transform.pitch)).toBe(0);
                done();
            });
        });

        test('style transform does not override map transform modified via setters', done => {
            const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
            expect(map.transform.unmodified).toBeTruthy();
            map.setZoom(10);
            map.setCenter([-77.0186, 38.8888]);
            expect(map.transform.unmodified).toBeFalsy();
            map.setStyle(createStyle());
            map.on('style.load', () => {
                expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
                expect(fixedNum(map.transform.zoom)).toBe(10);
                expect(fixedNum(map.transform.bearing)).toBe(0);
                expect(fixedNum(map.transform.pitch)).toBe(0);
                done();
            });
        });

        test('passing null removes style', () => {
            const map = createMap();
            const style = map.style;
            expect(style).toBeTruthy();
            jest.spyOn(style, '_remove');
            map.setStyle(null);
            expect(style._remove).toHaveBeenCalledTimes(1);
        });

        test('passing null releases the worker', () => {
            const map = createMap();
            const spyWorkerPoolAcquire = jest.spyOn(map.style.dispatcher.workerPool, 'acquire');
            const spyWorkerPoolRelease = jest.spyOn(map.style.dispatcher.workerPool, 'release');

            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
            expect(spyWorkerPoolAcquire).toHaveBeenCalledTimes(1);
            expect(spyWorkerPoolRelease).toHaveBeenCalledTimes(0);

            spyWorkerPoolAcquire.mockClear();
            map.setStyle(null);
            expect(spyWorkerPoolAcquire).toHaveBeenCalledTimes(0);
            expect(spyWorkerPoolRelease).toHaveBeenCalledTimes(1);

            // Cleanup
            spyWorkerPoolAcquire.mockClear();
            spyWorkerPoolRelease.mockClear();
        });

        test('transformStyle should copy the source and the layer into next style', done => {
            const style = extend(createStyle(), {
                sources: {
                    maplibre: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId0',
                    type: 'circle',
                    source: 'maplibre',
                    'source-layer': 'sourceLayer'
                }, {
                    id: 'layerId1',
                    type: 'circle',
                    source: 'maplibre',
                    'source-layer': 'sourceLayer'
                }]
            });

            const map = createMap({style});
            map.setStyle(createStyle(), {
                diff: false,
                transformStyle: (prevStyle, nextStyle) => ({
                    ...nextStyle,
                    sources: {
                        ...nextStyle.sources,
                        maplibre: prevStyle.sources.maplibre
                    },
                    layers: [
                        ...nextStyle.layers,
                        prevStyle.layers[0]
                    ]
                })
            });

            map.on('style.load', () => {
                const loadedStyle = map.style.serialize();
                expect('maplibre' in loadedStyle.sources).toBeTruthy();
                expect(loadedStyle.layers[0].id).toBe(style.layers[0].id);
                expect(loadedStyle.layers).toHaveLength(1);
                done();
            });
        });

        test('delayed setStyle with transformStyle should copy the source and the layer into next style with diffing', done => {
            const style = extend(createStyle(), {
                sources: {
                    maplibre: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId0',
                    type: 'circle',
                    source: 'maplibre',
                    'source-layer': 'sourceLayer'
                }, {
                    id: 'layerId1',
                    type: 'circle',
                    source: 'maplibre',
                    'source-layer': 'sourceLayer'
                }]
            });

            const map = createMap({style});
            window.setTimeout(() => {
                map.setStyle(createStyle(), {
                    diff: true,
                    transformStyle: (prevStyle, nextStyle) => ({
                        ...nextStyle,
                        sources: {
                            ...nextStyle.sources,
                            maplibre: prevStyle.sources.maplibre
                        },
                        layers: [
                            ...nextStyle.layers,
                            prevStyle.layers[0]
                        ]
                    })
                });

                const loadedStyle = map.style.serialize();
                expect('maplibre' in loadedStyle.sources).toBeTruthy();
                expect(loadedStyle.layers[0].id).toBe(style.layers[0].id);
                expect(loadedStyle.layers).toHaveLength(1);
                done();
            }, 100);
        });

        test('transformStyle should get called when passed to setStyle after the map is initialised without a style', done => {
            const map = createMap({deleteStyle: true});
            map.setStyle(createStyle(), {
                diff: true,
                transformStyle: (prevStyle, nextStyle) => {
                    expect(prevStyle).toBeUndefined();

                    return {
                        ...nextStyle,
                        sources: {
                            maplibre: {
                                type: 'vector',
                                minzoom: 1,
                                maxzoom: 10,
                                tiles: ['http://example.com/{z}/{x}/{y}.png']
                            }
                        },
                        layers: [{
                            id: 'layerId0',
                            type: 'circle',
                            source: 'maplibre',
                            'source-layer': 'sourceLayer'
                        }]
                    };
                }
            });

            map.on('style.load', () => {
                const loadedStyle = map.style.serialize();
                expect('maplibre' in loadedStyle.sources).toBeTruthy();
                expect(loadedStyle.layers[0].id).toBe('layerId0');
                done();
            });
        });

        test('map load should be fired when transformStyle is used on setStyle after the map is initialised without a style', done => {
            const map = createMap({deleteStyle: true});
            map.setStyle({version: 8, sources: {}, layers: []}, {
                diff: true,
                transformStyle: (prevStyle, nextStyle) => {
                    expect(prevStyle).toBeUndefined();
                    expect(nextStyle).toBeDefined();
                    return createStyle();
                }
            });
            map.on('load', () => done());
        });

        test('Override default style validation', () => {
            let validationOption = true;
            jest.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
                validationOption = options.validate;
            });
            const map = createMap({style: null});
            map.setStyle({version: 8, sources: {}, layers: []}, {validate: false});

            expect(validationOption).toBeFalsy();
        });
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

        test('Map#isSourceLoaded', done => {
            const style = createStyle();
            const map = createMap({style});

            map.on('load', () => {
                map.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'idle') {
                        expect(map.isSourceLoaded('geojson')).toBe(true);
                        done();
                    }
                });
                map.addSource('geojson', createStyleSource());
                expect(map.isSourceLoaded('geojson')).toBe(false);
            });
        });

        test('Map#isSourceLoaded (equivalent to event.isSourceLoaded)', done => {
            const style = createStyle();
            const map = createMap({style});

            map.on('load', () => {
                map.on('data', (e) => {
                    if (e.dataType === 'source' && 'source' in e) {
                        const sourceDataEvent = e as MapSourceDataEvent;
                        expect(map.isSourceLoaded('geojson')).toBe(sourceDataEvent.isSourceLoaded);
                        if (sourceDataEvent.sourceDataType === 'idle') {
                            done();
                        }
                    }
                });
                map.addSource('geojson', createStyleSource());
                expect(map.isSourceLoaded('geojson')).toBe(false);
            });
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

    describe('#getStyle', () => {
        test('returns undefined if the style has not loaded yet', done => {
            const style = createStyle();
            const map = createMap({style});
            expect(map.getStyle()).toBeUndefined();
            done();
        });

        test('returns the style', done => {
            const style = createStyle();
            const map = createMap({style});

            map.on('load', () => {
                expect(map.getStyle()).toEqual(style);
                done();
            });
        });

        test('returns the style with added sources', done => {
            const style = createStyle();
            const map = createMap({style});

            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                done();
            });
        });

        test('fires an error on checking if non-existant source is loaded', done => {
            const style = createStyle();
            const map = createMap({style});

            map.on('load', () => {
                map.on('error', ({error}) => {
                    expect(error.message).toMatch(/There is no source with ID/);
                    done();
                });
                map.isSourceLoaded('geojson');
            });
        });

        test('returns the style with added layers', done => {
            const style = createStyle();
            const map = createMap({style});
            const layer = {
                id: 'background',
                type: 'background'
            } as LayerSpecification;

            map.on('load', () => {
                map.addLayer(layer);
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    layers: [layer]
                }));
                done();
            });
        });

        test('a layer can be added even if a map is created without a style', () => {
            const map = createMap({deleteStyle: true});
            const layer = {
                id: 'background',
                type: 'background'
            } as LayerSpecification;
            map.addLayer(layer);
        });

        test('a source can be added even if a map is created without a style', () => {
            const map = createMap({deleteStyle: true});
            const source = createStyleSource();
            map.addSource('fill', source);
        });

        test('a layer can be added with an embedded source specification', () => {
            const map = createMap({deleteStyle: true});
            const source: GeoJSONSourceSpecification = {
                type: 'geojson',
                data: {type: 'Point', coordinates: [0, 0]}
            };
            map.addLayer({
                id: 'foo',
                type: 'symbol',
                source
            });
        });

        test('returns the style with added source and layer', done => {
            const style = createStyle();
            const map = createMap({style});
            const source = createStyleSource();
            const layer = {
                id: 'fill',
                type: 'fill',
                source: 'fill'
            } as LayerSpecification;

            map.on('load', () => {
                map.addSource('fill', source);
                map.addLayer(layer);
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    sources: {fill: source},
                    layers: [layer]
                }));
                done();
            });
        });

        test('creates a new Style if diff fails', () => {
            const style = createStyle();
            const map = createMap({style});
            jest.spyOn(map.style, 'setState').mockImplementation(() => {
                throw new Error('Dummy error');
            });
            jest.spyOn(console, 'warn').mockImplementation(() => {});

            const previousStyle = map.style;
            map.setStyle(style);
            expect(map.style && map.style !== previousStyle).toBeTruthy();
        });

        test('creates a new Style if diff option is false', () => {
            const style = createStyle();
            const map = createMap({style});
            const spy = jest.spyOn(map.style, 'setState');

            const previousStyle = map.style;
            map.setStyle(style, {diff: false});
            expect(map.style && map.style !== previousStyle).toBeTruthy();
            expect(spy).not.toHaveBeenCalled();
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

    describe('#resize', () => {
        test('sets width and height from container clients', () => {
            const map = createMap(),
                container = map.getContainer();

            Object.defineProperty(container, 'clientWidth', {value: 250});
            Object.defineProperty(container, 'clientHeight', {value: 250});
            map.resize();

            expect(map.transform.width).toBe(250);
            expect(map.transform.height).toBe(250);

        });

        test('fires movestart, move, resize, and moveend events', () => {
            const map = createMap(),
                events = [];

            (['movestart', 'move', 'resize', 'moveend'] as any).forEach((event) => {
                map.on(event, (e) => {
                    events.push(e.type);
                });
            });

            map.resize();
            expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);

        });

        test('listen to window resize event', () => {
            const spy = jest.fn();
            global.ResizeObserver = jest.fn().mockImplementation(() => ({
                observe: spy
            }));

            createMap();

            expect(spy).toHaveBeenCalled();
        });

        test('do not resize if trackResize is false', () => {
            let observerCallback: Function = null;
            global.ResizeObserver = jest.fn().mockImplementation((c) => ({
                observe: () => { observerCallback = c; }
            }));

            const map = createMap({trackResize: false});

            const spyA = jest.spyOn(map, 'stop');
            const spyB = jest.spyOn(map, '_update');
            const spyC = jest.spyOn(map, 'resize');

            observerCallback();

            expect(spyA).not.toHaveBeenCalled();
            expect(spyB).not.toHaveBeenCalled();
            expect(spyC).not.toHaveBeenCalled();
        });

        test('do resize if trackResize is true (default)', async () => {
            let observerCallback: Function = null;
            global.ResizeObserver = jest.fn().mockImplementation((c) => ({
                observe: () => { observerCallback = c; }
            }));

            const map = createMap();

            const updateSpy = jest.spyOn(map, '_update');
            const resizeSpy = jest.spyOn(map, 'resize');

            // The initial "observe" event fired by ResizeObserver should be captured/muted
            // in the map constructor

            observerCallback();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(resizeSpy).not.toHaveBeenCalled();

            // The next "observe" event should fire a resize / _update

            observerCallback();
            expect(updateSpy).toHaveBeenCalled();
            expect(resizeSpy).toHaveBeenCalledTimes(1);

            // Additional "observe" events should be throttled
            observerCallback();
            observerCallback();
            observerCallback();
            observerCallback();
            expect(resizeSpy).toHaveBeenCalledTimes(1);
            await new Promise((resolve) => { setTimeout(resolve, 100); });
            expect(resizeSpy).toHaveBeenCalledTimes(2);
        });

        test('width and height correctly rounded', () => {
            const map = createMap();
            const container = map.getContainer();

            Object.defineProperty(container, 'clientWidth', {value: 250.6});
            Object.defineProperty(container, 'clientHeight', {value: 250.6});
            map.resize();

            expect(map.getCanvas().width).toBe(250);
            expect(map.getCanvas().height).toBe(250);
            expect(map.painter.width).toBe(250);
            expect(map.painter.height).toBe(250);
        });
    });

    describe('#getBounds', () => {

        test('getBounds', () => {
            const map = createMap({zoom: 0});
            expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toBe(-0);
            expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toBe(0);

            expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
                [-70.31249999999976, -57.326521225216965],
                [70.31249999999977, 57.32652122521695]]));
        });

        test('rotated bounds', () => {
            const map = createMap({zoom: 1, bearing: 45});
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

            map.setBearing(135);
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

        });

        function toFixed(bounds) {
            const n = 10;
            return [
                [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
                [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
            ];
        }

        function normalizeFixed(num, n) {
            // workaround for "-0.0000000000" ≠ "0.0000000000"
            return parseFloat(num.toFixed(n)).toFixed(n);
        }
    });

    describe('#setMaxBounds', () => {
        test('constrains map bounds', () => {
            const map = createMap({zoom: 0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('when no argument is passed, map bounds constraints are removed', () => {
            const map = createMap({zoom: 0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]])
            ).toEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()));
        });

        test('should not zoom out farther than bounds', () => {
            const map = createMap();
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(map.setZoom(0).getZoom()).not.toBe(0);
        });

        function toFixed(bounds) {
            const n = 9;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }

    });

    describe('#getMaxBounds', () => {
        test('returns null when no bounds set', () => {
            const map = createMap({zoom: 0});
            expect(map.getMaxBounds()).toBeNull();
        });

        test('returns bounds', () => {
            const map = createMap({zoom: 0});
            const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]] as LngLatBoundsLike;
            map.setMaxBounds(bounds);
            expect(map.getMaxBounds().toArray()).toEqual(bounds);
        });

    });

    describe('#getRenderWorldCopies', () => {
        test('initially false', () => {
            const map = createMap({renderWorldCopies: false});
            expect(map.getRenderWorldCopies()).toBe(false);
        });

        test('initially true', () => {
            const map = createMap({renderWorldCopies: true});
            expect(map.getRenderWorldCopies()).toBe(true);
        });

    });

    describe('#setRenderWorldCopies', () => {
        test('initially false', () => {
            const map = createMap({renderWorldCopies: false});
            map.setRenderWorldCopies(true);
            expect(map.getRenderWorldCopies()).toBe(true);
        });

        test('initially true', () => {
            const map = createMap({renderWorldCopies: true});
            map.setRenderWorldCopies(false);
            expect(map.getRenderWorldCopies()).toBe(false);
        });

        test('undefined', () => {
            const map = createMap({renderWorldCopies: false});
            map.setRenderWorldCopies(undefined);
            expect(map.getRenderWorldCopies()).toBe(true);
        });

        test('null', () => {
            const map = createMap({renderWorldCopies: true});
            map.setRenderWorldCopies(null);
            expect(map.getRenderWorldCopies()).toBe(false);
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
                    expect(key).toBe('updateLayers');
                    expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
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

    describe('#setFeatureState', () => {
        test('sets state', done => {
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
        });
        test('works with string ids', done => {
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
        });
        test('parses feature id as an int', done => {
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
        });
        test('throw before loaded', done => {
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

            done();
        });
        test('fires an error if source not found', done => {
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
        });
        test('fires an error if sourceLayer not provided for a vector source', done => {
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
        });
        test('fires an error if id not provided', done => {
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
        });
    });

    describe('#removeFeatureState', () => {

        test('accepts "0" id', done => {
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
        });
        test('accepts string id', done => {
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
        });
        test('remove specific state property', done => {
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
        });
        test('remove all state properties of one feature', done => {
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
        });
        test('remove properties for zero-based feature IDs.', done => {
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
        });
        test('other properties persist when removing specific property', done => {
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
        });
        test('remove all state properties of all features in source', done => {
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
        });
        test('specific state deletion should not interfere with broader state deletion', done => {
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
        });
        test('add/remove and remove/add state', done => {
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
        });
        test('throw before loaded', done => {
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

            done();
        });
        test('fires an error if source not found', done => {
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
        });
        test('fires an error if sourceLayer not provided for a vector source', done => {
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
        });
        test('fires an error if state property is provided without a feature id', done => {
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
        });
    });

    describe('error event', () => {
        test('logs errors to console when it has NO listeners', () => {
            const map = createMap();
            const stub = jest.spyOn(console, 'error').mockImplementation(() => {});
            stub.mockReset();
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

    test('map fires `styleimagemissing` for missing icons', done => {
        const map = createMap();

        const id = 'missing-image';

        const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

        let called: string;
        map.on('styleimagemissing', e => {
            map.addImage(e.id, sampleImage);
            called = e.id;
        });

        expect(map.hasImage(id)).toBeFalsy();

        map.style.imageManager.getImages([id], (alwaysNull, generatedImage) => {
            expect(generatedImage[id].data.width).toEqual(sampleImage.width);
            expect(generatedImage[id].data.height).toEqual(sampleImage.height);
            expect(generatedImage[id].data.data).toEqual(sampleImage.data);
            expect(called).toBe(id);
            expect(map.hasImage(id)).toBeTruthy();
            done();
        });
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
        map.fire(new Event('dataabort'));
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

    describe('#setCooperativeGestures', () => {
        test('returns self', () => {
            const map = createMap();
            expect(map.setCooperativeGestures(true)).toBe(map);
        });

        test('can be called more than once', () => {
            const map = createMap();
            map.setCooperativeGestures(true);
            map.setCooperativeGestures(true);
        });

        test('calling set with no arguments turns cooperative gestures off', done => {
            const map = createMap({cooperativeGestures: true});
            map.on('load', () => {
                map.setCooperativeGestures();
                expect(map.getCooperativeGestures()).toBeFalsy();
                done();
            });
        });
    });

    describe('#getCooperativeGestures', () => {
        test('returns the cooperative gestures option', done => {
            const map = createMap({cooperativeGestures: true});

            map.on('load', () => {
                expect(map.getCooperativeGestures()).toBe(true);
                done();
            });
        });

        test('returns falsy if cooperative gestures option is not specified', done => {
            const map = createMap();

            map.on('load', () => {
                expect(map.getCooperativeGestures()).toBeFalsy();
                done();
            });
        });

        test('returns the cooperative gestures option with custom messages', done => {
            const option = {
                'windowsHelpText': 'Custom message',
                'macHelpText': 'Custom message',
                'mobileHelpText': 'Custom message',
            };
            const map = createMap({cooperativeGestures: option});

            map.on('load', () => {
                expect(map.getCooperativeGestures()).toEqual(option);
                done();
            });
        });
    });

    describe('cooperativeGestures option', () => {
        test('cooperativeGesture container element is hidden from a11y tree', () => {
            const map = createMap({cooperativeGestures: true});

            expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen').getAttribute('aria-hidden')).toBeTruthy();
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
            setErrorWebGlContext();
            try {
                createMap();
            } catch (e) {
                const errorMessageObject = JSON.parse(e.message);

                // this message is from map code
                expect(errorMessageObject.message).toBe('Failed to initialize WebGL');

                // this is from test mock
                expect(errorMessageObject.statusMessage).toBe('mocked webglcontextcreationerror message');
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
            const map = createMap({container, maxCanvasSize: [8192, 8192], pixelRatio: 5});
            map.resize();
            expect(map.getCanvas().width).toBe(8192);
            expect(map.getCanvas().height).toBe(8192);
        });

        test('maxCanvasSize width != height', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 1024});
            Object.defineProperty(container, 'clientHeight', {value: 2048});
            const map = createMap({container, maxCanvasSize: [8192, 4096], pixelRatio: 3});
            map.resize();
            expect(map.getCanvas().width).toBe(2048);
            expect(map.getCanvas().height).toBe(4096);
        });

        test('maxCanvasSize below clientWidth and clientHeigth', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 12834});
            Object.defineProperty(container, 'clientHeight', {value: 9000});
            const map = createMap({container, maxCanvasSize: [4096, 8192], pixelRatio: 1});
            map.resize();
            expect(map.getCanvas().width).toBe(4096);
            expect(map.getCanvas().height).toBe(2872);
        });

        test('maxCanvasSize with setPixelRatio', () => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'clientWidth', {value: 2048});
            Object.defineProperty(container, 'clientHeight', {value: 2048});
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

function createStyle() {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: []
    } as StyleSpecification;
}
