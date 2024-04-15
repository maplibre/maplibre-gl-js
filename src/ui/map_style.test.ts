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
        createMap({}, (error, map: Map) => {
            expect(error).toBeFalsy();

            const events = [];
            function recordEvent(event) { events.push(event.type); }

            map.on('styledata', recordEvent);
            map.on('styledataloading', recordEvent);
            map.on('sourcedata', recordEvent);
            map.on('sourcedataloading', recordEvent);
            map.on('tiledata', recordEvent);
            map.on('tiledataloading', recordEvent);

            map.style.fire(new EventedEvent('data', {dataType: 'style'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'style'}));
            map.style.fire(new EventedEvent('data', {dataType: 'source'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'source'}));
            map.style.fire(new EventedEvent('data', {dataType: 'tile'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'tile'}));

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

    test('setStyle back to the first style should work', async () => {
        const redStyle = {version: 8 as const, sources: {}, layers: [
            {id: 'background', type: 'background' as const, paint: {'background-color': 'red'}},
        ]};
        const blueStyle = {version: 8 as const, sources: {}, layers: [
            {id: 'background', type: 'background' as const, paint: {'background-color': 'blue'}},
        ]};
        const map = createMap({style: redStyle});
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        map.setStyle(blueStyle);
        await map.once('style.load');
        map.setStyle(redStyle);
        const serializedStyle =  map.style.serialize();
        expect(serializedStyle.layers[0].paint['background-color']).toBe('red');
        spy.mockRestore();
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
