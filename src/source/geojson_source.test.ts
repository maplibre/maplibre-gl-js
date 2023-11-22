import {Tile} from './tile';
import {OverscaledTileID} from './tile_id';
import {GeoJSONSource, GeoJSONSourceOptions} from './geojson_source';
import {Transform} from '../geo/transform';
import {LngLat} from '../geo/lng_lat';
import {extend} from '../util/util';
import {Dispatcher} from '../util/dispatcher';
import {RequestManager} from '../util/request_manager';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
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

describe('GeoJSONSource#setData', () => {
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

    test('fires "dataloading" event', done => {
        const source = createSource();
        source.on('dataloading', () => {
            done();
        });
        source.load();
    });

    test('fires "dataabort" event', done => {
        const source = new GeoJSONSource('id', {} as any, wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: true}), 0);
                });
            }
        }), undefined);
        source.on('dataabort', () => {
            done();
        });
        source.load();
    });

    test('respects collectResourceTiming parameter on source', done => {
        const source = createSource({collectResourceTiming: true});
        source.map = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            } as any as RequestManager
        } as any;
        source.actor.sendAsync = (message) => {
            return new Promise((resolve) => {
                if (message.type === 'loadData') {
                    expect((message.data as any).request.collectResourceTiming).toBeTruthy();
                    setTimeout(() => resolve({} as any), 0);
                    done();
                }
            });
        };
        source.setData('http://localhost/nonexistent');
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

    test('marks source as loaded before firing "dataabort" event', done => {
        const source = new GeoJSONSource('id', {} as any, wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: true}), 0);
                });
            }
        }), undefined);
        source.on('dataabort', () => {
            expect(source.loaded()).toBeTruthy();
            done();
        });
        source.setData({} as GeoJSON.GeoJSON);
    });
});

describe('GeoJSONSource#onRemove', () => {
    test('broadcasts "removeSource" event', done => {
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('removeSource');
                expect(message.data).toEqual({type: 'geojson', source: 'id'});
                done();
                return Promise.resolve({});
            },
            broadcast() {
                // Ignore
            }
        }), undefined);
        source.onRemove();
    });
});

describe('GeoJSONSource#update', () => {
    const transform = new Transform();
    transform.resize(200, 200);
    const lngLat = LngLat.convert([-122.486052, 37.830348]);
    const point = transform.locationPoint(lngLat);
    transform.zoom = 15;
    transform.setLocationAtPoint(lngLat, point);

    test('sends initial loadData request to dispatcher', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('loadData');
                done();
                return Promise.resolve({});
            }
        });

        new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined).load();
    });

    test('forwards geojson-vt options with worker request', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('loadData');
                expect(message.data.geojsonVtOptions).toEqual({
                    extent: 8192,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256,
                    lineMetrics: false,
                    generateId: true
                });
                done();
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
    });

    test('forwards Supercluster options with worker request', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('loadData');
                expect(message.data.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: 8192,
                    radius: 1600,
                    log: false,
                    generateId: true
                });
                done();
                return Promise.resolve({});
            }
        });

        new GeoJSONSource('id', {
            data: {},
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined).load();
    });

    test('modifying cluster properties after adding a source', done => {
        // test setCluster function on GeoJSONSource
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('loadData');
                expect(message.data.cluster).toBe(true);
                expect(message.data.superclusterOptions.radius).toBe(80);
                expect(message.data.superclusterOptions.maxZoom).toBe(16);
                done();
                return Promise.resolve({});
            }
        });
        new GeoJSONSource('id', {
            data: {},
            cluster: false,
            clusterMaxZoom: 8,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined).setClusterOptions({cluster: true, clusterRadius: 80, clusterMaxZoom: 16});
    });

    test('forwards Supercluster options with worker request, ignore max zoom of source', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                expect(message.type).toBe('loadData');
                expect(message.data.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: 8192,
                    radius: 1600,
                    log: false,
                    generateId: true
                });
                done();
                return Promise.resolve({});
            }
        });

        new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        } as GeoJSONSourceOptions, mockDispatcher, undefined).load();
    });

    test('transforms url before making request', () => {
        const mapStub = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            }
        } as any;
        const transformSpy = jest.spyOn(mapStub._requestManager, 'transformRequest');
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.onAdd(mapStub);
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toBe('https://example.com/data.geojson');
    });
    test('fires event when metadata loads', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({}), 0);
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') done();
        });

        source.load();
    });

    test('fires metadata data event even when initial request is aborted', done => {
        let requestCount = 0;
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({abandoned: requestCount++ === 0}));
                });
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);

        source.on('data', e => {
            if (e.sourceDataType === 'metadata') done();
        });

        source.load();
        source.setData({} as GeoJSON.GeoJSON);
    });

    test('fires "error"', done => {
        const mockDispatcher = wrapDispatcher({
            sendAsync(_message) {
                return Promise.reject('error'); // eslint-disable-line prefer-promise-reject-errors
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);

        source.on('error', (err) => {
            expect(err.error).toBe('error');
            done();
        });

        source.load();
    });

    test('sends loadData request to dispatcher after data update', done => {
        let expectedLoadDataCalls = 2;
        const mockDispatcher = wrapDispatcher({
            sendAsync(message) {
                if (message.type === 'loadData' && --expectedLoadDataCalls <= 0) {
                    done();
                }
                return new Promise((resolve) => setTimeout(() => resolve({}), 0));
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);
        source.map = {
            transform: {} as Transform,
            getPixelRatio() { return 1; }
        } as any;

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                source.setData({} as GeoJSON.GeoJSON);
                source.loadTile(new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512));
            }
        });

        source.load();
    });
});

describe('GeoJSONSource#serialize', () => {
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
