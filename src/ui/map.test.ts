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

    test('fires sourcedataabort event on dataabort event', async () => {
        const map = createMap();
        const sourcePromise = map.once('sourcedataabort');
        map.fire(new EventedEvent('dataabort'));
        await sourcePromise;
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
});
