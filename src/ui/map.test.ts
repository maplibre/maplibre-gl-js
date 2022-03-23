import Map, {MapOptions} from './map';
import {createMap, setMatchMedia, setPerformance, setWebGlContext} from '../util/test/util';
import LngLat from '../geo/lng_lat';
import Tile from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {Event, ErrorEvent} from '../util/evented';
import simulate from '../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../test/unit/lib/fixed';
import {LayerSpecification, SourceSpecification, StyleSpecification} from '../style-spec/types.g';
import {RequestTransformFunction} from '../util/request_manager';
import {extend} from '../util/util';
import {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import {IControl} from './control/control';
import EvaluationParameters from '../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';

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
    setPerformance();
    setWebGlContext();
    setMatchMedia();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('Map', () => {

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
            expect(map.transform.zoom).toBe(0.6983039737971012);
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
    });

    describe('#setTransformRequest', () => {
        test('returns self', () => {
            const transformRequest  = (() => { }) as any as RequestTransformFunction;
            const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
            expect(map.setTransformRequest(transformRequest)).toBe(map);
            expect(map._requestManager._transformRequestFn).toBe(transformRequest);
        });

        test('can be called more than once', () => {
            const map = createMap();

            const transformRequest = (() => { }) as any as RequestTransformFunction;
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
                    if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                        expect(map.isSourceLoaded('geojson')).toBe(true);
                        done();
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

    test('#moveLayer', done => {
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

        map.once('render', () => {
            map.moveLayer('layerId1', 'layerId2');
            expect(map.getLayer('layerId1').id).toBe('layerId1');
            expect(map.getLayer('layerId2').id).toBe('layerId2');
            done();
        });
    });

    test('#getLayer', done => {
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

        map.once('render', () => {
            const mapLayer = map.getLayer('layerId');
            expect(mapLayer.id).toBe(layer.id);
            expect(mapLayer.type).toBe(layer.type);
            expect(mapLayer.source).toBe(layer.source);
            done();
        });
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

        test('listen to window resize event', done => {
            const original = global.addEventListener;
            global.addEventListener = function(type) {
                if (type === 'resize') {
                    //restore original function not to mess with other tests
                    global.addEventListener = original;

                    done();
                }
            };

            createMap();
        });

        test('do not resize if trackResize is false', () => {
            const map = createMap({trackResize: false});

            const spyA = jest.spyOn(map, 'stop');
            const spyB = jest.spyOn(map, '_update');
            const spyC = jest.spyOn(map, 'resize');

            map._onWindowResize(undefined);

            expect(spyA).not.toHaveBeenCalled();
            expect(spyB).not.toHaveBeenCalled();
            expect(spyC).not.toHaveBeenCalled();
        });

        test('do resize if trackResize is true (default)', () => {
            const map = createMap();

            const spyA = jest.spyOn(map, '_update');
            const spyB = jest.spyOn(map, 'resize');

            map._onWindowResize(undefined);

            expect(spyA).toHaveBeenCalled();
            expect(spyB).toHaveBeenCalled();
        });

    });

    describe('#getBounds', () => {

        test('getBounds', () => {
            const map = createMap({zoom: 0});
            expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toBe(-0);
            expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toBe(0);

            expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
                [ -70.31249999999976, -57.326521225216965 ],
                [ 70.31249999999977, 57.32652122521695 ] ]));
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
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('when no argument is passed, map bounds constraints are removed', () => {
            const map = createMap({zoom:0});
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
            const map = createMap({zoom:0});
            expect(map.getMaxBounds()).toBeNull();
        });

        test('returns bounds', () => {
            const map = createMap({zoom:0});
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
        const map = createMap({zoom:5});
        map.setMinZoom(3.5);
        map.setZoom(1);
        expect(map.getZoom()).toBe(3.5);
    });

    test('unset minZoom', () => {
        const map = createMap({minZoom:5});
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
        const map = createMap({zoom:2, maxZoom:5});
        expect(() => {
            map.setMinZoom(6);
        }).toThrow();
        map.setZoom(0);
        expect(map.getZoom()).toBe(0);
    });

    test('#setMaxZoom', () => {
        const map = createMap({zoom:0});
        map.setMaxZoom(3.5);
        map.setZoom(4);
        expect(map.getZoom()).toBe(3.5);
    });

    test('unset maxZoom', () => {
        const map = createMap({maxZoom:5});
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
        const map = createMap({minZoom:5});
        expect(() => {
            map.setMaxZoom(4);
        }).toThrow();
        map.setZoom(5);
        expect(map.getZoom()).toBe(5);
    });

    test('throw on maxZoom smaller than minZoom at init', () => {
        expect(() => {
            createMap({minZoom:10, maxZoom:5});
        }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
    });

    test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
        expect(() => {
            createMap({minZoom:1, maxZoom:0});
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
        const map = createMap({maxPitch:10});
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
        const map = createMap({minPitch:10});
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
        expect(map.getContainer().childNodes).toHaveLength(2);
        map.remove();
        expect(map.getContainer().childNodes).toHaveLength(0);
    });

    test('#remove calls onRemove on added controls', () => {
        const map = createMap();
        const control = {
            onRemove: jest.fn(),
            onAdd (_) {
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
            onAdd (_) {
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

    test('#redraw', done => {
        const map = createMap();

        map.once('idle', () => {
            map.once('render', () => done());

            map.redraw();
        });
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
                map.style.dispatcher.broadcast = function(key, value: any) {
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

        test('fires a data event', done => {
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

            map.once('style.load', () => {
                map.once('data', (e) => {
                    if (e.dataType === 'style') {
                        done();
                    }
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
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

    test('no idle event during move', done => {
        const style = createStyle();
        const map = createMap({style, fadeDuration: 0});
        map.once('idle', () => {
            map.zoomTo(0.5, {duration: 100});
            expect(map.isMoving()).toBeTruthy();
            map.once('idle', () => {
                expect(!map.isMoving()).toBeTruthy();
                done();
            });
        });
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

        let called;
        map.on('styleimagemissing', e => {
            map.addImage(e.id, {width: 1, height: 1, data: new Uint8Array(4)});
            called = e.id;
        });

        expect(map.hasImage(id)).toBeFalsy();

        map.style.imageManager.getImages([id], () => {
            expect(called).toBe(id);
            expect(map.hasImage(id)).toBeTruthy();
            done();
        });
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

    test('fires sourcedataabort event on dataabort event', done => {
        const map = createMap();
        map.once('sourcedataabort', () => done());
        map.fire(new Event('dataabort'));
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
