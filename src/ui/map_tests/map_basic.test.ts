import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Map, type MapOptions} from '../map';
import {createMap, beforeMapTest, createStyle, createStyleSource} from '../../util/test/util';
import {Tile} from '../../source/tile';
import {OverscaledTileID} from '../../source/tile_id';
import {fixedLngLat} from '../../../test/unit/lib/fixed';
import {type RequestTransformFunction} from '../../util/request_manager';
import {type MapSourceDataEvent} from '../events';
import {MessageType} from '../../util/actor_messages';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
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

        test('Map#isStyleLoaded', () => new Promise<void>(done => {
            const style = createStyle();
            const map = createMap({style});

            expect(map.isStyleLoaded()).toBe(false);
            map.on('load', () => {
                expect(map.isStyleLoaded()).toBe(true);
                done();
            });
        }));

        test('Map#areTilesLoaded', () => new Promise<void>(done => {
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
        }));
    });

    test('#remove', () => {
        const map = createMap();
        const spyWorkerPoolRelease = vi.spyOn(map.style.dispatcher.workerPool, 'release');
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
            onRemove: vi.fn(),
            onAdd(_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        expect(control.onRemove).toHaveBeenCalledTimes(1);
    });

    test('#remove calls onRemove on added controls before style is destroyed', () => new Promise<void>(done => {
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
    }));

    test('#remove broadcasts removeMap to worker', () => {
        const map = createMap();
        const _broadcastSpyOn = vi.spyOn(map.style.dispatcher, 'broadcast');
        map.remove();
        expect(_broadcastSpyOn).toHaveBeenCalledWith(MessageType.removeMap, undefined);
    });

    test('#project', () => {
        const map = createMap();
        expect(map.project([0, 0])).toEqual({x: 100, y: 100});
    });

    test('#unproject', () => {
        const map = createMap();
        expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: 0});
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
