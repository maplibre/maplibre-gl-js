import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {Tile} from '../tile/tile.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {GeoJSONSource, type GeoJSONSourceShouldReloadTileOptions, type GeoJSONSourceOptions} from './geojson_source.ts';
import {EXTENT} from '../data/extent.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {extend} from '../util/util.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorProjection} from '../geo/projection/mercator_projection.ts';
import {beforeMapTest, createMap, getWrapDispatcher, sleep, waitForEvent, waitForMetadataEvent} from '../util/test/util.ts';
import {AbortError} from '../util/abort_error.ts';
import {type ActorMessage, type ClusterIDAndSource, type GeoJSONWorkerSourceLoadDataResult, MessageType} from '../util/actor_messages.ts';
import {CrsWorldCoordinateHelper, simpleCrs} from '../geo/projection/crs.ts';
import {latFromMercatorY} from '../geo/mercator_coordinate.ts';
import {fakeServer, type FakeServer} from 'nise';

import type {RequestTransformFunction} from '../util/request_manager.ts';
import type {LoadGeoJSONParameters} from './geojson_worker_source.ts';
import type {MapSourceDataEvent} from '../ui/events.ts';
import type {GeoJSONSourceDiff, UpdateableGeoJSON} from './geojson_source_diff.ts';
import type {Projection} from '../geo/projection/projection.ts';
import type {Map} from '../ui/map.ts';

const wrapDispatcher = getWrapDispatcher();

let map: Map;

beforeEach(async () => {
    beforeMapTest();
    map = createMap();
    await map.once('style.load');
});

afterEach(() => {
    map.remove();
});

const performanceMark = window.performance.mark;

/** `beforeMapTest` stubs `performance.mark`; a test that measures a request wants the real one back. */
function restorePerformanceMarks(): void {
    window.performance.mark = performanceMark;
}

/** The test's map, switched to the given projection. */
function mapWithProjection(projection: Projection): Map {
    map.style.projection = projection;
    return map;
}

/** A second map whose request manager runs the given transform; the test removes it. */
async function createMapTransformingRequests(transformRequest: RequestTransformFunction): Promise<Map> {
    const transformingMap = createMap({transformRequest});
    await transformingMap.once('style.load');
    return transformingMap;
}

const mockDispatcher = wrapDispatcher({
    sendAsync() { return Promise.resolve({}); }
});

function createSource(opts?: Partial<GeoJSONSourceOptions>) {
    const source = new GeoJSONSource('id', extend({}, opts, {data: {}}) as GeoJSONSourceOptions, wrapDispatcher({
        sendAsync(_message) {
            return new Promise((resolve) => {
                setTimeout(() => resolve({}), 0);
            });
        }
    }), undefined);
    source.map = map;
    return source;
}

const hawkHill = {
    'type': 'FeatureCollection',
    'features': [{
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [
                [-122.48369693756104, 37.83381888486939],
                [-122.48348236083984, 37.83317489144141],
                [-122.48339653015138, 37.83270036637107],
                [-122.48356819152832, 37.832056363179625],
                [-122.48404026031496, 37.83114119107971],
                [-122.48404026031496, 37.83049717427869],
                [-122.48348236083984, 37.829920943955045],
                [-122.48356819152832, 37.82954808664175],
                [-122.48507022857666, 37.82944639795659],
                [-122.48610019683838, 37.82880236636284],
                [-122.48695850372314, 37.82931081282506],
                [-122.48700141906738, 37.83080223556934],
                [-122.48751640319824, 37.83168351665737],
                [-122.48803138732912, 37.832158048267786],
                [-122.48888969421387, 37.83297152392784],
                [-122.48987674713133, 37.83263257682617],
                [-122.49043464660643, 37.832937629287755],
                [-122.49125003814696, 37.832429207817725],
                [-122.49163627624512, 37.832564787218985],
                [-122.49223709106445, 37.83337825839438],
                [-122.49378204345702, 37.83368330777276]
            ]
        }
    }]
} as GeoJSON.GeoJSON;

describe('GeoJSONSource.constructor', () => {
    const mapStub = {
        _requestManager: {
            transformRequest: (url: string) => ({url})
        }
    } as any;
    test('warn if maxzoom <= clusterMaxZoom', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const source = new GeoJSONSource('id', {data: hawkHill, maxzoom: 4, clusterMaxZoom: 4} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        source.load();

        expect(warn).toHaveBeenCalledWith('The maxzoom value "4" is expected to be greater than the clusterMaxZoom value "4".');

        warn.mockRestore();
    });
    test('warn if clusterMaxZoom non-integer', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const source = new GeoJSONSource('id', {data: hawkHill, maxzoom: 4, clusterMaxZoom: 3.5} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        source.load();

        expect(warn).toHaveBeenCalledWith('Integer expected for option \'clusterMaxZoom\': provided value "3.5" rounded to "4"');

        warn.mockRestore();
    });
});

describe('GeoJSONSource.setData', () => {
    test('fires "data" event', async () => {
        const source = createSource();
        const loadPromise = source.once('data');
        source.load();
        await expect(loadPromise).resolves.toBeDefined();

        const setDataPromise = source.once('data');
        source.setData({} as GeoJSON.GeoJSON);
        await expect(setDataPromise).resolves.toBeDefined();
    });

    test('fires "dataloading" event', async () => {
        const source = createSource();
        const promise = source.once('dataloading');
        source.load();
        await expect(promise).resolves.toBeDefined();
    });

    test('fires "dataabort" event', async () => {
        const source = new GeoJSONSource('id', {data: {}} as any, wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: true} as GeoJSONWorkerSourceLoadDataResult), 0);
                });
            }
        }), undefined);
        source.map = map;
        const promise = source.once('dataabort');
        source.load();
        await expect(promise).resolves.toBeDefined();
    });

    test('respects collectResourceTiming parameter on source', async () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {collectResourceTiming: true} as any, wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                return new Promise((resolve, reject) => {
                    if (message.type === MessageType.loadData) {
                        setTimeout(() => resolve({} as any), 0);
                        spy(message);
                    } else {
                        reject(new Error(`MessageType.loadData is expected but got ${message.type}`));
                    }
                });
            }
        }), undefined);
        source.map = map;
        source.setData('http://localhost/nonexistent');
        await sleep(0);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].data.request.collectResourceTiming).toBeTruthy();
    });

    test('respects collectResourceTiming parameter on source (async transformRequest)', async () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {collectResourceTiming: true} as any, wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                return new Promise((resolve) => {
                    if (message.type === MessageType.loadData) {
                        spy(message);
                        resolve({});
                    }
                });
            }
        }), undefined);
        const transformingMap = await createMapTransformingRequests(async (url) => ({url}));
        source.map = transformingMap;
        await source.setData('http://localhost/nonexistent');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].data.request.collectResourceTiming).toBeTruthy();
        transformingMap.remove();
    });

    test('only marks source as loaded when there are no pending loads', async () => {
        const source = createSource();
        const setDataPromise = source.once('data');
        source.setData({} as GeoJSON.GeoJSON);
        source.setData({} as GeoJSON.GeoJSON);
        await setDataPromise;
        expect(source.loaded()).toBeFalsy();
        const setDataPromise2 = source.once('data');
        await setDataPromise2;
        expect(source.loaded()).toBeTruthy();
    });

    test('resolves the returned promise only after the queued update completes', async () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {data: {}} as any, wrapDispatcher({
            sendAsync(message) {
                return new Promise((resolve) => {
                    setTimeout(() => { spy(message); resolve({}); }, 0);
                });
            }
        }), undefined);
        source.map = map;

        const firstPromise = source.setData({} as GeoJSON.GeoJSON);
        const secondPromise = source.setData({} as GeoJSON.GeoJSON);

        await secondPromise;
        expect(spy).toHaveBeenCalledTimes(2);
        expect(source.loaded()).toBeTruthy();
        await firstPromise;
    });

    test('marks source as not loaded before firing "dataloading" event', async () => {
        const source = createSource();
        const setDataPromise = source.once('dataloading');
        source.setData({} as GeoJSON.GeoJSON);
        await setDataPromise;
        expect(source.loaded()).toBeFalsy();
    });

    test('marks source as loaded before firing "data" event', async () => {
        const source = createSource();
        const dataPromise = source.once('data');
        source.setData({} as GeoJSON.GeoJSON);
        await dataPromise;
        expect(source.loaded()).toBeTruthy();
    });

    test('marks source as loaded before firing "dataabort" event', async () => {
        const source = new GeoJSONSource('id', {} as any, wrapDispatcher({
            sendAsync(_message: ActorMessage<MessageType>) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: true} as GeoJSONWorkerSourceLoadDataResult), 0);
                });
            }
        }), undefined);
        source.map = map;
        const promise = waitForEvent(source, 'dataabort', () => true);
        source.setData({} as GeoJSON.GeoJSON);
        await promise;
        expect(source.loaded()).toBeTruthy();
    });
});

describe('GeoJSONSource.loadTile', () => {
    const mapStub = {
        getPixelRatio() { return 1; },
        showCollisionBoxes: false,
        style: {projection: new MercatorProjection()}
    } as any;

    test('swallows an AbortError from the worker request', async () => {
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() {
                return Promise.reject(new AbortError());
            }
        }), undefined);
        source.map = mapStub;

        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), source.tileSize);
        const loadVectorDataSpy = vi.spyOn(tile, 'loadVectorData');

        await expect(source.loadTile(tile)).resolves.toBeUndefined();
        expect(loadVectorDataSpy).not.toHaveBeenCalled();
        expect(tile.abortController).toBeUndefined();
    });

    test('swallows a worker error when the tile was aborted', async () => {
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() {
                tile.aborted = true;
                return Promise.reject(new Error('worker error'));
            }
        }), undefined);
        source.map = mapStub;

        const loadVectorDataSpy = vi.spyOn(tile, 'loadVectorData');

        await expect(source.loadTile(tile)).resolves.toBeUndefined();
        expect(loadVectorDataSpy).not.toHaveBeenCalled();
        expect(tile.abortController).toBeUndefined();
    });

    test('rethrows a non-abort error from the worker request', async () => {
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() {
                return Promise.reject(new Error('worker error'));
            }
        }), undefined);
        source.map = mapStub;

        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), source.tileSize);
        const loadVectorDataSpy = vi.spyOn(tile, 'loadVectorData');

        await expect(source.loadTile(tile)).rejects.toThrow('worker error');
        expect(loadVectorDataSpy).not.toHaveBeenCalled();
        expect(tile.abortController).toBeUndefined();
    });
});

describe('GeoJSONSource.onRemove', () => {
    test('broadcasts "removeSource" event', async () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                spy(message);
                return Promise.resolve({});
            }
        }), undefined);
        source.map = map;
        source.onRemove();
        await sleep(0);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.removeSource);
        expect(spy.mock.calls[0][0].data).toEqual({type: 'geojson', source: 'id'});
    });
});

describe('GeoJSONSource.update', () => {
    const transform = new MercatorTransform();
    transform.resize(200, 200);
    const lngLat = LngLat.convert([-122.486052, 37.830348]);
    const point = transform.locationToScreenPoint(lngLat);
    transform.setZoom(15);
    transform.setLocationAtPoint(lngLat, point);

    test('sends initial loadData request to dispatcher', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                spy(message);
                return Promise.resolve({});
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await sleep(0);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
    });

    test('forwards geojson-vt options with worker request', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message: ActorMessage<any>) {
                spy(message);
                return Promise.resolve({});
            }
        });

        const source = new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            tolerance: 0.25,
            buffer: 16,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await sleep(0);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions).toEqual({
            extent: EXTENT,
            maxZoom: 10,
            tolerance: 4,
            buffer: 256,
            lineMetrics: false,
            generateId: true,
            promoteId: undefined,
            cluster: false,
            clusterOptions: {
                extent: 8192,
                generateId: true,
                log: false,
                maxZoom: 9,
                minPoints: 2,
                radius: 800,
            },
        });
    });

    test('forwards Supercluster options with worker request', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return Promise.resolve({});
            }
        });

        const source = new GeoJSONSource('id', {
            data: {},
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await sleep(0);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.clusterOptions).toEqual({
            maxZoom: 12,
            minPoints: 3,
            extent: EXTENT,
            radius: 100 * EXTENT / source.tileSize,
            log: false,
            generateId: true
        });
    });

    test('modifying cluster properties after adding a source', async () => {
        // test setCluster function on GeoJSONSource
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return Promise.resolve({});
            }
        });
        const source = new GeoJSONSource('id', {
            type: 'geojson',
            data: {} as GeoJSON.GeoJSON,
            cluster: false,
            clusterMaxZoom: 8,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        }, mockDispatcher, undefined);
        source.map = map;

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockClear();

        source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});
        await sleep(0);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.cluster).toBe(true);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.clusterOptions.radius).toBe(80 * EXTENT / source.tileSize);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.clusterOptions.maxZoom).toBe(16);
    });

    test('modifying cluster properties with pending data', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(structuredClone(message));
                return Promise.resolve({});
            }
        });
        const source = new GeoJSONSource('id', {
            type: 'geojson',
            data: {} as GeoJSON.GeoJSON,
            cluster: false,
            clusterMaxZoom: 8,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        }, mockDispatcher, undefined);
        source.map = map;

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockClear();

        // Initiate first data update
        const sourceData1 = {id: 'test-1', type: 'FeatureCollection', features: []} as GeoJSON.GeoJSON;
        source.setData(sourceData1);

        // Immediately modify data again, and update cluster options
        const sourceData2 = {id: 'test-2', type: 'FeatureCollection', features: []} as GeoJSON.GeoJSON;
        source.setData(sourceData2);
        await source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});

        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.cluster).toBe(true);
        expect(spy.mock.calls[0][0].data.data).toEqual(sourceData1);
        expect(spy.mock.calls[0][0].data.dataDiff).toBeUndefined();
        expect(spy.mock.calls[1][0].data.geojsonVtOptions.cluster).toBe(true);
        expect(spy.mock.calls[1][0].data.geojsonVtOptions.clusterOptions.radius).toBe(80 * EXTENT / source.tileSize);
        expect(spy.mock.calls[1][0].data.geojsonVtOptions.clusterOptions.maxZoom).toBe(16);
        expect(spy.mock.calls[1][0].data.data).toEqual(sourceData2);
        expect(spy.mock.calls[1][0].data.dataDiff).toBeUndefined();
        expect(spy.mock.calls[2][0].data.geojsonVtOptions.cluster).toBe(true);
        expect(spy.mock.calls[2][0].data.geojsonVtOptions.clusterOptions.radius).toBe(80 * EXTENT / source.tileSize);
        expect(spy.mock.calls[2][0].data.geojsonVtOptions.clusterOptions.maxZoom).toBe(16);
        expect(spy.mock.calls[2][0].data.data).toBeUndefined();
        expect(spy.mock.calls[2][0].data.dataDiff).toBeUndefined();
    });

    test('modifying cluster properties after sending a diff', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(structuredClone(message));
                return Promise.resolve({});
            }
        });
        const geoJsonData = {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'id': 1,
                    'properties': {},
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [-122.48369693756104, 37.83381888486939]
                    }
                }
            ]
        } as GeoJSON.GeoJSON;

        const source = new GeoJSONSource('id', {
            type: 'geojson',
            data: geoJsonData,
            cluster: false,
            clusterMaxZoom: 8,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        }, mockDispatcher, undefined);
        source.map = map;

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockReset();

        const diff = {remove: [1]};
        source.updateData(diff);
        await sleep(0);
        source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});

        await sleep(0);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.cluster).toBe(false);
        expect(spy.mock.calls[0][0].data.dataDiff).toEqual(diff);
        expect(spy.mock.calls[1][0].data.geojsonVtOptions.cluster).toBe(true);
        expect(spy.mock.calls[1][0].data.data).toBeUndefined();
        expect(spy.mock.calls[1][0].data.dataDiff).toBeUndefined();
    });

    test('forwards Supercluster options with worker request, ignore max zoom of source', async () => {
        const spy = vi.fn();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return Promise.resolve({});
            }
        });

        const source = new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await sleep(0);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.geojsonVtOptions.clusterOptions).toEqual({
            maxZoom: 12,
            minPoints: 3,
            extent: EXTENT,
            radius: 100 * EXTENT / source.tileSize,
            log: false,
            generateId: true
        });
    });

    test('transforms url before making request', async () => {
        const transformRequest = vi.fn((url: string) => ({url}));
        const transformingMap = await createMapTransformingRequests(transformRequest);
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.onAdd(transformingMap);
        expect(transformRequest).toHaveBeenCalledTimes(1);
        expect(transformRequest.mock.calls[0][0]).toBe('https://example.com/data.geojson');
        transformingMap.remove();
    });

    test('updates _data.geojson when worker returns data from URL load', async () => {
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() { return Promise.resolve({data: hawkHill}); }
        }), undefined);
        source.map = map;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        source.load();
        await promise;

        expect(source.serialize()).toStrictEqual({type: 'geojson', data: hawkHill});
    });

    test('can asynchronously transform request', async () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return Promise.resolve({});
            }
        }), undefined);
        const transformingMap = await createMapTransformingRequests(async (url) => ({
            url,
            headers: {Authorization: 'Bearer token'}
        }));
        source.map = transformingMap;
        await source.load();
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].data.request).toEqual({
            url: 'https://example.com/data.geojson',
            headers: {Authorization: 'Bearer token'}
        });
        transformingMap.remove();
    });

    test('fires event when metadata loads', async () =>  {
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message: ActorMessage<MessageType>) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        source.load();

        await expect(promise).resolves.toBeDefined();
    });

    test('fires metadata data event even when initial request is aborted', async () => {
        let requestCount = 0;
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: requestCount++ === 0} as GeoJSONWorkerSourceLoadDataResult));
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        source.load();
        source.setData({} as GeoJSON.GeoJSON);

        await expect(promise).resolves.toBeDefined();
    });

    test('fires "error"', async () => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return Promise.reject('error');
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        const promise = waitForEvent(source, 'error', () => true);

        source.load();

        const err = await promise;
        expect(err.error).toBeInstanceOf(Error);
        expect(err.error.message).toBe('error');
    });

    test('sends loadData request to dispatcher after data update', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                if (message.type === MessageType.loadData) {
                    spy();
                }
                const emptyGeoJSONTile = null;
                return new Promise((resolve) => setTimeout(() => resolve(message.type === MessageType.loadTile ? emptyGeoJSONTile : {}), 0));
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        let updates = 0;
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && updates++ < 3) {
                source.setData({} as GeoJSON.GeoJSON);
                source.loadTile(new Tile(new OverscaledTileID(0, 0, 0, 0, 0), source.tileSize));
            }
        });

        source.load();

        await sleep(100);
        expect(spy.mock.calls.length).toBeGreaterThan(2);
    });
});

describe('GeoJSONSource.getData', () => {
    const mapStub = {
        _requestManager: {
            transformRequest: (url: string) => ({url})
        },
        style: {projection: new MercatorProjection()}
    } as any;
    test('gets the data when passed as a geojson object', async () => {
        const source = new GeoJSONSource('id', {data: hawkHill} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        await expect(source.getData()).resolves.toStrictEqual(hawkHill);
    });

    test('waits for data to load when source has a URL', async () => {
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() { return Promise.resolve({data: hawkHill}); }
        }), undefined);
        source.map = mapStub;

        source.load();
        const data = await source.getData();
        expect(data).toStrictEqual(hawkHill);
    });

    test('returns added features from getData when updateData is called immediately after initialization', async () => {
        const source = new GeoJSONSource('id', {data: {type: 'FeatureCollection', features: []}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();

        const diff: GeoJSONSourceDiff = {
            add: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
                {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [1, 1]}},
            ]
        };
        await source.updateData(diff);
        const data = await source.getData();
        expect(data).toStrictEqual({
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
                {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [1, 1]}},
            ]
        });
    });

    test('waits for data to load when source is updateable after update data', async () => {
        const initialData: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
            ]
        };

        const source = new GeoJSONSource('id', {data: initialData} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const diff: GeoJSONSourceDiff = {
            update: [{id: 0, newGeometry: {type: 'Point', coordinates: [0, 1]}}]
        };
        await source.updateData(diff);
        const data = await source.getData();
        expect(data).toStrictEqual({
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 1]}},
            ]
        });
    });
});

describe('GeoJSONSource.updateData', () => {
    test('queues a second call to updateData', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockClear();

        // Call updateData multiple times while the worker is still processing the initial data
        const update1 = {
            remove: ['1'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        const update2 = {
            remove: ['4'],
            add: [{id: '5', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '6', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        await source.updateData(update1);
        await source.updateData(update2);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].data.dataDiff).toEqual(update1);
        expect(spy.mock.calls[1][0].data.dataDiff).toEqual(update2);
    });

    test('combines multiple diffs when data is loading', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        // Perform an initial setData
        const data1 = {type: 'FeatureCollection', features: []} satisfies GeoJSON.GeoJSON;
        source.setData(data1);

        // Call updateData multiple times while the worker is still processing the initial data
        const update1 = {
            remove: ['1'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        const update2 = {
            remove: ['4'],
            add: [{id: '5', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'Point', coordinates: []}}, {id: '6', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        source.updateData(update1);
        source.updateData(update2);

        // Wait for the setData and updateData calls to be performed
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].data.data).toEqual(data1);
        expect(spy.mock.calls[1][0].data.dataDiff).toEqual({
            remove: ['1', '4'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}, {id: '5', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'Point', coordinates: []}}, {id: '6', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        });
    });

    test('merges diffs of a promoteId source by the promoted id when data is loading', async () => {
        const source = createSource({promoteId: 'id'});
        const spy = vi.spyOn(await source.actorPromise, 'sendAsync');

        source.setData({type: 'FeatureCollection', features: []});
        source.updateData({add: [
            {type: 'Feature', properties: {id: 'a'}, geometry: {type: 'LineString', coordinates: []}},
            {type: 'Feature', properties: {id: 'b'}, geometry: {type: 'LineString', coordinates: []}}
        ]});
        source.updateData({remove: ['b']});
        await waitForMetadataEvent(source);
        await waitForMetadataEvent(source);

        expect((spy.mock.calls[1][0].data as LoadGeoJSONParameters).dataDiff).toEqual({
            remove: ['b'],
            add: [{type: 'Feature', properties: {id: 'a'}, geometry: {type: 'LineString', coordinates: []}}],
            update: []
        });
    });

    test('is overwritten by a subsequent call to setData when data is loading', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        // Perform an initial setData
        const data1 = {type: 'FeatureCollection', features: []} satisfies GeoJSON.GeoJSON;
        source.setData(data1);

        // Queue an updateData
        const update1 = {
            remove: ['1'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        source.updateData(update1);

        // Call setData while the worker is still processing the initial data
        const data2 = {type: 'FeatureCollection', features: [{id: '1', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}]} satisfies GeoJSON.GeoJSON;
        source.setData(data2);

        // Wait for both setData calls to be performed
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].data.data).toEqual(data1);
        expect(spy.mock.calls[1][0].data.data).toEqual(data2);
    });

    test('is queued after setData when data is loading', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        // Perform an initial setData
        const data1 = {type: 'FeatureCollection', features: []} satisfies GeoJSON.GeoJSON;
        source.setData(data1);

        // Queue a setData
        const data2: UpdateableGeoJSON = {type: 'FeatureCollection', features: [{id: '1', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}]};
        source.setData(data2);

        // Queue an updateData
        const update1 = {
            remove: ['1'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}],
            update: [{id: '3', addOrUpdateProperties: [], newGeometry: {type: 'LineString', coordinates: []}}]
        } satisfies GeoJSONSourceDiff;
        source.updateData(update1);

        // Wait for the calls to be performed
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[0][0].data.data).toEqual(data1);
        expect(spy.mock.calls[1][0].data.data).toEqual(data2);
        expect(spy.mock.calls[2][0].data.dataDiff).toEqual(update1);
    });

    test('throws error when updating data that is not compatible with updateData', async () => {
        const initialData: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
            ]
        };

        const source = new GeoJSONSource('id', {data: initialData} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const errorPromise = waitForEvent(source, 'error', () => true);
        source.updateData({add: [{type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [1, 1]}}]});
        const error = await errorPromise;
        expect(error.error.message).toBe('GeoJSONSource "id": GeoJSON data is not compatible with updateData');
    });
});

describe('GeoJSONSource.getBounds', () => {
    const mapStub = {
        _requestManager: {
            transformRequest: (url: string) => ({url})
        }
    } as any;

    test('get bounds returns result from getGeoJSONBounds util', async () => {
        const source = new GeoJSONSource('id', {
            data: {
                type: 'LineString',
                coordinates: [
                    [1.1, 1.2],
                    [1.3, 1.4]
                ]
            }
        } as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        const bounds = await source.getBounds();
        expect(bounds.getNorthEast().lat).toBe(1.4);
        expect(bounds.getNorthEast().lng).toBe(1.3);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });

    test('get bounds returns result with elevation', async () => {
        const source = new GeoJSONSource('id', {
            data: {
                type: 'LineString',
                coordinates: [
                    [1.1, 1.2, 3250],
                    [1.3, 1.4, 3251]
                ]
            }
        } as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        const bounds = await source.getBounds();
        expect(bounds.getNorthEast().lat).toBe(1.4);
        expect(bounds.getNorthEast().lng).toBe(1.3);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });
});

describe('GeoJSONSource.serialize', () => {
    const mapStub = {
        _requestManager: {
            transformRequest: (url: string) => ({url})
        }
    } as any;
    test('serialize source with inline data', () => {
        const source = new GeoJSONSource('id', {data: hawkHill} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        source.load();
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: hawkHill
        });
    });

    test('serialize source with url', () => {
        const source = new GeoJSONSource('id', {data: 'local://data.json'} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        source.load();
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: 'local://data.json'
        });
    });

    test('serialize source with updated data', () => {
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = mapStub;
        source.load();
        source.setData(hawkHill);
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: hawkHill
        });
    });

    test('serialize source with additional options', () => {
        const source = new GeoJSONSource('id', {data: {}, cluster: true} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: {},
            cluster: true
        });
    });
});

describe('GeoJSONSource.load', () => {
    test('is noop when all data is already loaded', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        // Run again, with no additional data loaded
        source.load();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('No pending worker updates for GeoJSONSource id.');
    });
});

describe('GeoJSONSource.applyDiff', () => {
    test('applies diff', async () => {
        const initialData: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
            ]
        };

        const source = new GeoJSONSource('id', {data: initialData} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const diff: GeoJSONSourceDiff = {
            update: [{id: 0, newGeometry: {type: 'Point', coordinates: [0, 1]}}]
        };
        await source.updateData(diff);

        expect(source.serialize().data).toEqual({
            type: 'FeatureCollection',
            features: [
                {type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 1]}},
            ]
        });
    });
});

describe('GeoJSONSource.shoudReloadTile', () => {
    let source: GeoJSONSource;
    let tile: Tile;

    beforeEach(() => {
        source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = {style: {projection: new MercatorProjection()}} as any as Map;
        tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), source.tileSize);
        tile.state = 'loaded';
    });

    test('returns true when tile is still loading', () => {
        tile.state = 'loading';
        const result = source.shouldReloadTile(tile, {} as GeoJSONSourceShouldReloadTileOptions);

        expect(result).toBe(true);
    });

    test('returns false when tile has been unloaded', () => {
        tile.state = 'unloaded';

        const result = source.shouldReloadTile(tile, {} as GeoJSONSourceShouldReloadTileOptions);

        expect(result).toBe(false);
    });

    test('fires undefined when diff.removeAll is true', async () => {
        const diff: GeoJSONSourceDiff = {removeAll: true};

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);

        expect(shouldReloadTileOptions).toBeUndefined();
    });

    test('returns true when tile contains a feature that is being updated', async () => {
        const diff: GeoJSONSourceDiff = {
            update: [{
                id: 0,
                newGeometry: {type: 'Point', coordinates: [1, 1]}
            }]
        };

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.setData({type: 'FeatureCollection', features: [{type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]});
        await source.updateData(diff);
        const result = source.shouldReloadTile(tile, shouldReloadTileOptions);

        expect(result).toBeTruthy();
    });

    test('returns false when tile contains a feature that is being removed but was never added', async () => {
        const diff: GeoJSONSourceDiff = {remove: [0]};
        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);
        const result = source.shouldReloadTile(tile, shouldReloadTileOptions);

        expect(result).toBe(false);
    });

    test('returns false when diff has no changes affecting the tile', async () => {
        // Feature far away from tile bounds
        const tile = new Tile(new OverscaledTileID(10, 0, 10, 500, 500), source.tileSize);
        tile.state = 'loaded';
        const diff: GeoJSONSourceDiff = {
            add: [{
                id: 1,
                type: 'Feature',
                properties: {},
                geometry: {type: 'Point', coordinates: [-170, -80]}
            }]
        };
        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);
        const result = source.shouldReloadTile(tile, shouldReloadTileOptions);

        expect(result).toBe(false);
    });

    test('reloads a tile that contains an added feature in the map projection', async () => {
        source.map = {style: {projection: new MercatorProjection(new CrsWorldCoordinateHelper(simpleCrs))}} as any as Map;
        const tileOfLng0To90Lat0To90InTheSimpleCrs = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), source.tileSize);
        tileOfLng0To90Lat0To90InTheSimpleCrs.state = 'loaded';
        const diff: GeoJSONSourceDiff = {add: [{id: 1, type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}}]};
        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);

        expect(source.shouldReloadTile(tileOfLng0To90Lat0To90InTheSimpleCrs, shouldReloadTileOptions)).toBe(true);
    });

    test('does not reload a tile for an added feature that only mercator would place inside it', async () => {
        source.map = {style: {projection: new MercatorProjection(new CrsWorldCoordinateHelper(simpleCrs))}} as any as Map;
        const tileOfLng0To90Lat0To90InTheSimpleCrs = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), source.tileSize);
        tileOfLng0To90Lat0To90InTheSimpleCrs.state = 'loaded';
        const insideTheMercatorTileOfLng0To180 = [125, 15];
        const diff: GeoJSONSourceDiff = {add: [{id: 1, type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: insideTheMercatorTileOfLng0To180}}]};
        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);

        expect(source.shouldReloadTile(tileOfLng0To90Lat0To90InTheSimpleCrs, shouldReloadTileOptions)).toBe(false);
    });

    test('returns false when diff is empty', async () => {
        const diff: GeoJSONSourceDiff = {};

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);
        const result = source.shouldReloadTile(tile, shouldReloadTileOptions);

        expect(result).toBe(false);
    });

    test('handles string feature ids and returns no bounds since feature does not exist', async () => {
        const diff: GeoJSONSourceDiff = {remove: ['abc']};

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);

        expect(shouldReloadTileOptions.affectedBounds).toHaveLength(0);
    });

    test('handles cluster', async () => {
        const diff: GeoJSONSourceDiff = {remove: [1]};
        source = new GeoJSONSource('id', {data: {}, cluster: true} as GeoJSONSourceOptions, mockDispatcher, undefined);

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff);

        expect(shouldReloadTileOptions).toBeUndefined();
    });
});

describe('GeoJSONSource.getClusterExpansionZoom', () => {
    test('should send data to worker and get response', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync: spy.mockResolvedValue({})
        });
        const source = new GeoJSONSource('id', {data: {}, cluster: true} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        await source.getClusterExpansionZoom(1);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.getClusterExpansionZoom);
        expect((spy.mock.calls[0][0].data as ClusterIDAndSource).clusterId).toBe(1);
        vi.resetAllMocks();
    });
});

describe('GeoJSONSource.getClusterChildren', () => {
    test('should send data to worker and get response', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync: spy.mockResolvedValue({})
        });
        const source = new GeoJSONSource('id', {data: {}, cluster: true} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        await source.getClusterChildren(1);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.getClusterChildren);
        expect((spy.mock.calls[0][0].data as ClusterIDAndSource).clusterId).toBe(1);
        vi.resetAllMocks();
    });
});

describe('GeoJSONSource.getClusterLeaves', () => {
    test('should send data to worker and get response', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync: spy.mockResolvedValue({})
        });
        const source = new GeoJSONSource('id', {data: {}, cluster: true} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = map;
        await source.getClusterLeaves(1, 0, 1);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.getClusterLeaves);
        expect((spy.mock.calls[0][0].data as ClusterIDAndSource).clusterId).toBe(1);
        vi.resetAllMocks();
    });
});

describe('GeoJSONSource.getClusterOptions', () => {
    test('returns the cluster options configured on the source', () => {
        const source = new GeoJSONSource('id', {
            type: 'geojson',
            data: {} as GeoJSON.GeoJSON,
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 80
        }, mockDispatcher, undefined);
        source.map = map;

        expect(source.getClusterOptions()).toEqual({cluster: true, clusterMaxZoom: 12, clusterRadius: 80});
    });

    test('reflects options updated via setClusterOptions', async () => {
        const source = new GeoJSONSource('id', {
            type: 'geojson',
            data: {} as GeoJSON.GeoJSON,
            cluster: false
        }, mockDispatcher, undefined);
        source.map = map;

        const options = {cluster: true, clusterMaxZoom: 9, clusterRadius: 40};
        await source.setClusterOptions(options);

        expect(source.getClusterOptions()).toEqual(options);
    });
});

describe('GeoJSONSource in a planar projection', () => {
    function createSimpleCrsProjection(): Projection {
        return new MercatorProjection(new CrsWorldCoordinateHelper(simpleCrs));
    }

    /** lng/lat 45/45 is world (0.75, 0.25) in the simple CRS; mercator puts that world position at this lng/lat. */
    function pseudoLngLatOf45(): GeoJSON.Position {
        return [90, latFromMercatorY(0.25)];
    }

    function createPointData(): GeoJSON.FeatureCollection {
        return {
            type: 'FeatureCollection',
            features: [{type: 'Feature', id: 1, properties: {name: 'p'}, geometry: {type: 'Point', coordinates: [45, 45]}}]
        };
    }

    function createSpiedSource(options: GeoJSONSourceOptions, map: Map, respond: (message: ActorMessage<MessageType>) => any) {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', options, wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                spy(message);
                return Promise.resolve(respond(message));
            }
        }), undefined);
        source.map = map;
        return {source, spy};
    }

    function expectPseudo(coordinates: GeoJSON.Position) {
        const pseudo = pseudoLngLatOf45();
        expect(coordinates[0]).toBeCloseTo(pseudo[0], 9);
        expect(coordinates[1]).toBeCloseTo(pseudo[1], 9);
    }

    /** The worker's answer to a tile request is the empty GeoJSON tile a real painter accepts; anything else gets an empty result. */
    function respondWithEmptyTiles(message: ActorMessage<MessageType>) {
        return message.type === MessageType.loadTile || message.type === MessageType.reloadTile ? null : {};
    }

    function createTile(): Tile {
        return new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
    }

    /** The `loadData` parameters the source sent, in order; tile requests are left out. */
    function sentLoadData(spy: ReturnType<typeof vi.fn>): LoadGeoJSONParameters[] {
        return spy.mock.calls.map(call => call[0] as ActorMessage<MessageType>).filter(message => message.type === MessageType.loadData).map(message => message.data as LoadGeoJSONParameters);
    }

    test('sends object data pre-projected and keeps the original', async () => {
        const data = createPointData();
        const {source, spy} = createSpiedSource({data} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
        const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        source.load();
        await loaded;

        const sent = spy.mock.calls[0][0].data.data as GeoJSON.FeatureCollection;
        expect(sent).not.toBe(data);
        expectPseudo((sent.features[0].geometry as GeoJSON.Point).coordinates);
        expect((data.features[0].geometry as GeoJSON.Point).coordinates).toEqual([45, 45]);
        expect(source.serialize().data).toBe(data);
    });

    test('sends mercator data as is', async () => {
        const data = createPointData();
        const {source, spy} = createSpiedSource({data} as GeoJSONSourceOptions, map, () => ({}));
        const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        source.load();
        await loaded;
        expect(spy.mock.calls[0][0].data.data).toBe(data);
    });

    describe('url data', () => {
        let server: FakeServer;
        beforeEach(() => {
            global.fetch = null;
            server = fakeServer.create();
            server.respondImmediately = true;
        });
        afterEach(() => {
            server.restore();
        });

        test('is fetched on the main thread and sent pre-projected', async () => {
            const data = createPointData();
            server.respondWith('/data.geojson', JSON.stringify(data));
            const {source, spy} = createSpiedSource({data: '/data.geojson'} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
            const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
            source.load();
            await loaded;

            const params = spy.mock.calls[0][0].data;
            expect(params.request).toBeUndefined();
            expectPseudo((params.data.features[0].geometry as GeoJSON.Point).coordinates);
            expect(source.serialize().data).toEqual(data);
            await expect(source.getData()).resolves.toEqual(data);
        });

        test('is left to the worker for mercator', async () => {
            const {source, spy} = createSpiedSource({data: '/data.geojson'} as GeoJSONSourceOptions, map, () => ({}));
            const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
            source.load();
            await loaded;
            expect(spy.mock.calls[0][0].data.request).toEqual({url: 'http://localhost/data.geojson', collectResourceTiming: undefined});
            expect(spy.mock.calls[0][0].data.data).toBeUndefined();
            expect(server.requests).toHaveLength(0);
        });

        test('reports a failed fetch as an error event', async () => {
            server.respondWith('/missing.geojson', [404, {}, '']);
            const {source} = createSpiedSource({data: '/missing.geojson'} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
            const error = source.once('error');
            source.load();
            await expect(error).resolves.toBeDefined();
        });

        test('keeps resource timing for the main-thread fetch', async () => {
            restorePerformanceMarks();
            server.respondWith('/data.geojson', JSON.stringify(createPointData()));
            const {source} = createSpiedSource({data: '/data.geojson', collectResourceTiming: true} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
            const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
            source.load();
            const event = await loaded;
            expect(event.resourceTiming).toHaveLength(1);
            expect(event.resourceTiming[0].name).toBe('http://localhost/data.geojson');
        });
    });

    test('pre-projects added features and new geometries of a diff', async () => {
        const {source, spy} = createSpiedSource({data: {type: 'FeatureCollection', features: []}} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        spy.mockClear();

        const diff: GeoJSONSourceDiff = {
            remove: ['1'],
            add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}}],
            update: [
                {id: '3', newGeometry: {type: 'Point', coordinates: [45, 45]}},
                {id: '4', addOrUpdateProperties: [{key: 'a', value: 1}]}
            ]
        };
        await source.updateData(diff);

        const sent = spy.mock.calls[0][0].data.dataDiff as GeoJSONSourceDiff;
        expect(sent.remove).toEqual(['1']);
        expectPseudo((sent.add[0].geometry as GeoJSON.Point).coordinates);
        expectPseudo((sent.update[0].newGeometry as GeoJSON.Point).coordinates);
        expect(sent.update[1]).toBe(diff.update[1]);
        expect((diff.add[0].geometry as GeoJSON.Point).coordinates).toEqual([45, 45]);
    });

    test('applies a diff to its own data in real lng/lat', async () => {
        const {source} = createSpiedSource({data: {type: 'FeatureCollection', features: []}} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), () => ({}));
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const content = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'content');
        await source.updateData({add: [{id: '2', type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}}]});

        const data = await source.getData() as GeoJSON.FeatureCollection;
        expect((data.features[0].geometry as GeoJSON.Point).coordinates).toEqual([45, 45]);
        const {shouldReloadTileOptions} = await content;
        expect(shouldReloadTileOptions.affectedBounds[0].toArray()).toEqual([[45, 45], [45, 45]]);
    });

    test('maps cluster children and leaves back to the map lng/lat', async () => {
        const workerFeature = (): GeoJSON.Feature => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: pseudoLngLatOf45()}});
        const {source} = createSpiedSource({data: createPointData()} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), (message) => {
            if (message.type === MessageType.getClusterChildren || message.type === MessageType.getClusterLeaves) return [workerFeature()];
            return {};
        });
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        for (const features of [await source.getClusterChildren(1), await source.getClusterLeaves(1, 10, 0)]) {
            const coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
            expect(coordinates[0]).toBeCloseTo(45, 9);
            expect(coordinates[1]).toBeCloseTo(45, 9);
        }
    });

    test('does not resend the data when a tile loads under another projection with the same world mapping', async () => {
        const data = createPointData();
        const {source, spy} = createSpiedSource({data} as GeoJSONSourceOptions, map, respondWithEmptyTiles);
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        map.style.projection = new MercatorProjection();
        await source.loadTile(createTile());
        await sleep(0);

        expect(sentLoadData(spy)).toHaveLength(1);
    });

    test('resends the data pre-projected when a tile loads after the projection became planar, and as is after it went back to mercator', async () => {
        const data = createPointData();
        const {source, spy} = createSpiedSource({data} as GeoJSONSourceOptions, map, respondWithEmptyTiles);
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const resentPlanar = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        map.style.projection = createSimpleCrsProjection();
        await source.loadTile(createTile());
        await resentPlanar;
        expect(sentLoadData(spy)).toHaveLength(2);
        expectPseudo(((sentLoadData(spy)[1].data as GeoJSON.FeatureCollection).features[0].geometry as GeoJSON.Point).coordinates);

        const resentMercator = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        map.style.projection = new MercatorProjection();
        await source.loadTile(createTile());
        await resentMercator;
        expect(sentLoadData(spy)).toHaveLength(3);
        expect(sentLoadData(spy)[2].data).toBe(data);
    });

    test('keeps a diff that is still waiting for the worker when the projection changes', async () => {
        const {source, spy} = createSpiedSource({data: {type: 'FeatureCollection', features: []}} as GeoJSONSourceOptions, map, respondWithEmptyTiles);
        source.load();
        source.updateData({add: [{id: '1', type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}}]});
        map.style.projection = createSimpleCrsProjection();
        await source.loadTile(createTile());
        await vi.waitFor(() => expect(source.loaded()).toBe(true));

        const sent = sentLoadData(spy);
        expect(sent.map(params => params.dataDiff ? 'diff' : 'data')).toEqual(['data', 'data', 'diff']);
        expectPseudo((sent[2].dataDiff.add[0].geometry as GeoJSON.Point).coordinates);
        const data = await source.getData() as GeoJSON.FeatureCollection;
        expect((data.features[0].geometry as GeoJSON.Point).coordinates).toEqual([45, 45]);
    });

    test('keeps the ids promoteId derives through a pre-projected diff and through the re-send after a projection change', async () => {
        const {source, spy} = createSpiedSource({data: createPointData(), promoteId: 'name'} as GeoJSONSourceOptions, mapWithProjection(createSimpleCrsProjection()), respondWithEmptyTiles);
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        await source.updateData({update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [45, 0]}}]});
        const sentUpdate = sentLoadData(spy)[1].dataDiff.update[0];
        expect(sentUpdate.id).toBe('p');
        expect((sentUpdate.newGeometry as GeoJSON.Point).coordinates).toEqual([90, expect.closeTo(0, 9)]);
        const data = await source.getData() as GeoJSON.FeatureCollection;
        expect(data.features[0].properties.name).toBe('p');
        expect((data.features[0].geometry as GeoJSON.Point).coordinates).toEqual([45, 0]);

        const resent = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        map.style.projection = new MercatorProjection();
        await source.loadTile(createTile());
        await resent;
        const resentFeature = (sentLoadData(spy)[2].data as GeoJSON.FeatureCollection).features[0];
        expect(resentFeature.properties.name).toBe('p');
        expect((resentFeature.geometry as GeoJSON.Point).coordinates).toEqual([45, 0]);
    });
});
