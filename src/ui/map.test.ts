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

    test('#project', () => {
        const map = createMap();
        expect(map.project([0, 0])).toEqual({x: 100, y: 100});
    });

    test('#unproject', () => {
        const map = createMap();
        expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: 0});
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
});
