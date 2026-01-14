import {describe, test, expect, vi, beforeEach} from 'vitest';
import {Tile} from '../tile/tile';
import {OverscaledTileID} from '../tile/tile_id';
import {GeoJSONSource, type GeoJSONSourceShouldReloadTileOptions, type GeoJSONSourceOptions} from './geojson_source';
import {EXTENT} from '../data/extent';
import {LngLat} from '../geo/lng_lat';
import {extend} from '../util/util';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {sleep, waitForEvent} from '../util/test/util';
import {type ActorMessage, MessageType} from '../util/actor_messages';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {Dispatcher} from '../util/dispatcher';
import type {RequestManager} from '../util/request_manager';
import type {Actor} from '../util/actor';
import type {MapSourceDataEvent} from '../ui/events';
import type {GeoJSONSourceDiff, UpdateableGeoJSON} from './geojson_source_diff';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher as Actor;
        }
    } as Dispatcher;
};

const mockDispatcher = wrapDispatcher({
    sendAsync() { return Promise.resolve({}); }
});

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
            transformRequest: (url) => { return {url}; }
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
    function createSource(opts?) {
        opts = opts || {};
        opts = extend(opts, {data: {}});
        return new GeoJSONSource('id', opts, wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        }), undefined);
    }

    test('returns self', () => {
        const source = createSource();
        expect(source.setData({} as GeoJSON.GeoJSON)).toBe(source);
    });

    test('fires "data" event', async () => {
        const source = createSource();
        const loadPromise = source.once('data');
        source.load();
        await loadPromise;
        const setDataPromise = source.once('data');
        source.setData({} as GeoJSON.GeoJSON);
        await setDataPromise;
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
                    setTimeout(() => resolve({abandoned: true}), 0);
                });
            }
        }), undefined);
        const promise = source.once('dataabort');
        source.load();
        await expect(promise).resolves.toBeDefined();
    });

    test('respects collectResourceTiming parameter on source', () => {
        const source = createSource({collectResourceTiming: true});
        source.map = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            } as any as RequestManager
        } as any;
        const spy = vi.fn();
        source.actor.sendAsync = (message: ActorMessage<MessageType>) => {
            return new Promise((resolve) => {
                if (message.type === MessageType.loadData) {
                    expect((message.data as any).request.collectResourceTiming).toBeTruthy();
                    setTimeout(() => resolve({} as any), 0);
                    spy();
                }
            });
        };
        source.setData('http://localhost/nonexistent');
        expect(spy).toHaveBeenCalled();
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
                    setTimeout(() => resolve({abandoned: true}), 0);
                });
            }
        }), undefined);
        const promise = waitForEvent(source, 'dataabort', () => true);
        source.setData({} as GeoJSON.GeoJSON);
        await promise;
        expect(source.loaded()).toBeTruthy();
    });

    test('setData with waitForCompletion=true returns promise that resolves to this', async () => {
        const source = new GeoJSONSource('id', {} as any, wrapDispatcher({
            sendAsync(_message: ActorMessage<MessageType>) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: true}), 0);
                });
            }
        }), undefined);
        const result = source.setData({} as GeoJSON.GeoJSON, true);
        expect(result).toBeInstanceOf(Promise);
    });
});

describe('GeoJSONSource.onRemove', () => {
    test('broadcasts "removeSource" event', () => {
        const spy = vi.fn();
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                expect(message.type).toBe(MessageType.removeSource);
                expect(message.data).toEqual({type: 'geojson', source: 'id'});
                spy();
                return Promise.resolve({});
            },
            broadcast() {
                // Ignore
            }
        }), undefined);
        source.onRemove();
        expect(spy).toHaveBeenCalled();
    });
});

describe('GeoJSONSource.update', () => {
    const transform = new MercatorTransform();
    transform.resize(200, 200);
    const lngLat = LngLat.convert([-122.486052, 37.830348]);
    const point = transform.locationToScreenPoint(lngLat);
    transform.setZoom(15);
    transform.setLocationAtPoint(lngLat, point);

    test('sends initial loadData request to dispatcher', () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message: ActorMessage<MessageType>) {
                expect(message.type).toBe(MessageType.loadData);
                spy();
                return Promise.resolve({});
            }
        });

        new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined).load();
        expect(spy).toHaveBeenCalled();
    });

    test('forwards geojson-vt options with worker request', () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message: ActorMessage<any>) {
                expect(message.type).toBe(MessageType.loadData);
                expect(message.data.geojsonVtOptions).toEqual({
                    extent: EXTENT,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256,
                    lineMetrics: false,
                    generateId: true
                });
                spy();
                return Promise.resolve({});
            }
        });

        new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            tolerance: 0.25,
            buffer: 16,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined).load();
        expect(spy).toHaveBeenCalled();
    });

    test('forwards Supercluster options with worker request', () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe(MessageType.loadData);
                expect(message.data.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: EXTENT,
                    radius: 100 * EXTENT / source.tileSize,
                    log: false,
                    generateId: true
                });
                spy();
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
        source.load();
        expect(spy).toHaveBeenCalled();
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

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockClear();

        source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.cluster).toBe(true);
        expect(spy.mock.calls[0][0].data.superclusterOptions.radius).toBe(80 * EXTENT / source.tileSize);
        expect(spy.mock.calls[0][0].data.superclusterOptions.maxZoom).toBe(16);
    });

    test('modifying cluster properties with pending data', async () => {
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
        source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].type).toBe(MessageType.loadData);
        expect(spy.mock.calls[0][0].data.cluster).toBe(false);
        expect(spy.mock.calls[0][0].data.data).toBe(sourceData1);
        expect(spy.mock.calls[0][0].data.dataDiff).toBeUndefined();
        expect(spy.mock.calls[1][0].data.cluster).toBe(true);
        expect(spy.mock.calls[1][0].data.superclusterOptions.radius).toBe(80 * EXTENT / source.tileSize);
        expect(spy.mock.calls[1][0].data.superclusterOptions.maxZoom).toBe(16);
        expect(spy.mock.calls[1][0].data.data).toBe(sourceData2);
        expect(spy.mock.calls[1][0].data.dataDiff).toBeUndefined();
    });

    test('modifying cluster properties after sending a diff', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                spy(message);
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

        // Wait for initial data to be loaded
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        spy.mockReset();

        const diff = {remove: [1]};
        source.updateData(diff);
        source.setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[0][0].data.cluster).toBe(false);
        expect(spy.mock.calls[0][0].data.dataDiff).toEqual(diff);
        expect(spy.mock.calls[1][0].data.cluster).toEqual(true);
        expect(spy.mock.calls[1][0].data.data).not.toBeDefined();
        expect(spy.mock.calls[1][0].data.dataDiff).not.toBeDefined();
    });

    test('forwards Supercluster options with worker request, ignore max zoom of source', () => {
        const spy = vi.fn();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe(MessageType.loadData);
                expect(message.data.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: EXTENT,
                    radius: 100 * EXTENT / source.tileSize,
                    log: false,
                    generateId: true
                });
                spy();
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
        source.load();
        expect(spy).toHaveBeenCalled();
    });

    test('transforms url before making request', () => {
        const mapStub = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            }
        } as any;
        const transformSpy = vi.spyOn(mapStub._requestManager, 'transformRequest');
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.onAdd(mapStub);
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toBe('https://example.com/data.geojson');
    });

    test('updates _data.geojson when worker returns data from URL load', async () => {
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync() { return Promise.resolve({data: hawkHill}); }
        }), undefined);
        source.map = {_requestManager: {transformRequest: (url) => ({url})}} as any;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        source.load();
        await promise;

        expect(source.serialize()).toStrictEqual({type: 'geojson', data: hawkHill});
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

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        source.load();

        await expect(promise).resolves.toBeDefined();
    });

    test('fires metadata data event even when initial request is aborted', async () => {
        let requestCount = 0;
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: requestCount++ === 0}));
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);

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

        const promise = waitForEvent(source, 'error', () => true);

        source.load();

        const err = await promise;
        expect(err.error).toBe('error');
    });

    test('sends loadData request to dispatcher after data update', async () => {
        const spy = vi.fn();
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                if (message.type === MessageType.loadData) {
                    spy();
                }
                return new Promise((resolve) => setTimeout(() => resolve({}), 0));
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = {
            transform: {} as IReadonlyTransform,
            getPixelRatio() { return 1; },
            getGlobalState: () => ({}),
            style: {
                projection: {
                    get subdivisionGranularity() {
                        return SubdivisionGranularitySetting.noSubdivision;
                    }
                }
            }
        } as any;

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
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
            transformRequest: (url) => { return {url}; }
        }
    } as any;
    test('sends a message with a correct type to the worker and forwards the data provided returned by it', async () => {
        const source = new GeoJSONSource('id', {data: hawkHill} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe(MessageType.getData);
                return Promise.resolve({});
            }
        }), undefined);
        source.map = mapStub;

        // This is a bit dumb test, as communication with the worker is mocked, and thus the worker always returns an
        // empty object instead of returning the result of an actual computation.
        await expect(source.getData()).resolves.toStrictEqual({});
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
        await source.updateData(update1, true);
        await source.updateData(update2, true);

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
            transformRequest: (url) => { return {url}; }
        }
    } as any;

    test('get bounds returns result from getGeoJSONBounds util', async () => {
        const source = new GeoJSONSource('id', {data: hawkHill} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe(MessageType.getData);
                return Promise.resolve({
                    type: 'LineString',
                    coordinates: [
                        [1.1, 1.2],
                        [1.3, 1.4]
                    ]
                });
            }
        }), undefined);
        source.map = mapStub;
        const bounds = await source.getBounds();
        expect(bounds.getNorthEast().lat).toBe(1.4);
        expect(bounds.getNorthEast().lng).toBe(1.3);
        expect(bounds.getSouthWest().lat).toBe(1.2);
        expect(bounds.getSouthWest().lng).toBe(1.1);
    });

    test('get bounds returns result with elevation', async () => {
        const source = new GeoJSONSource('id', {data: hawkHill} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe(MessageType.getData);
                return Promise.resolve({
                    type: 'LineString',
                    coordinates: [
                        [1.1, 1.2, 3250],
                        [1.3, 1.4, 3251]
                    ]
                });
            }
        }), undefined);
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
            transformRequest: (url) => { return {url}; }
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
        source.load();
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const diff: GeoJSONSourceDiff = {
            update: [{id: 0, newGeometry: {type: 'Point', coordinates: [0, 1]}}]
        };
        await source.updateData(diff, true);

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
        await source.updateData(diff, true);

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
        await source.setData({type: 'FeatureCollection', features: [{type: 'Feature', id: 0, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]}, true);
        await source.updateData(diff, true);
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
        await source.updateData(diff, true);
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
        await source.updateData(diff, true);
        const result = source.shouldReloadTile(tile, shouldReloadTileOptions);

        expect(result).toBe(false);
    });

    test('returns false when diff is empty', async () => {
        const diff: GeoJSONSourceDiff = {};

        let shouldReloadTileOptions: GeoJSONSourceShouldReloadTileOptions = undefined;
        source.on('data', (e) => {
            if (e.shouldReloadTileOptions) {
                shouldReloadTileOptions = e.shouldReloadTileOptions;
            }
        });
        await source.updateData(diff, true);
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
        await source.updateData(diff, true);

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
        await source.updateData(diff, true);

        expect(shouldReloadTileOptions).toBeUndefined();
    });

});
