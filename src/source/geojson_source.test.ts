import Tile from './tile';
import {OverscaledTileID} from './tile_id';
import GeoJSONSource, {GeoJSONSourceOptions} from './geojson_source';
import Transform from '../geo/transform';
import LngLat from '../geo/lng_lat';
import {extend} from '../util/util';
import Dispatcher from '../util/dispatcher';
import {RequestManager} from '../util/request_manager';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        }
    } as Dispatcher;
};

const mockDispatcher = wrapDispatcher({
    send() {}
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
            send (type, data, callback) {
                if (callback) {
                    return setTimeout(callback, 0);
                }
            }
        }), undefined);
    }

    test('returns self', () => {
        const source = createSource();
        expect(source.setData({} as GeoJSON.GeoJSON)).toBe(source);
    });

    test('fires "data" event', done => {
        const source = createSource();
        source.once('data', () => {
            source.once('data', () => {
                done();
            });
            source.setData({} as GeoJSON.GeoJSON);
        });
        source.load();
    });

    test('fires "dataloading" event', done => {
        const source = createSource();
        source.on('dataloading', () => {
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
        source.actor.send = function(type, params: any, cb) {
            if (type === 'geojson.loadData') {
                expect(params.request.collectResourceTiming).toBeTruthy();
                setTimeout(cb, 0);
                done();
            }
        } as any;
        source.setData('http://localhost/nonexistent');
    });

    test('only marks source as loaded when there are no pending loads', done => {
        const source = createSource();
        source.once('data', () => {
            expect(source.loaded()).toBeFalsy();
            source.once('data', () => {
                expect(source.loaded()).toBeTruthy();
                done();
            });
        });
        source.setData({} as GeoJSON.GeoJSON);
        source.setData({} as GeoJSON.GeoJSON);
    });

    test('marks source as not loaded before firing "dataloading" event', done => {
        const source = createSource();
        source.once('dataloading', () => {
            expect(source.loaded()).toBeFalsy();
            done();
        });
        source.setData({} as GeoJSON.GeoJSON);
    });

    test('marks source as loaded before firing "data" event', done => {
        const source = createSource();
        source.once('data', () => {
            expect(source.loaded()).toBeTruthy();
            done();
        });
        source.setData({} as GeoJSON.GeoJSON);
    });
});

describe('GeoJSONSource#onRemove', () => {
    test('broadcasts "removeSource" event', done => {
        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, wrapDispatcher({
            send(type, data, callback) {
                expect(callback).toBeFalsy();
                expect(type).toBe('removeSource');
                expect(data).toEqual({type: 'geojson', source: 'id'});
                done();
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
            send(message) {
                expect(message).toBe('geojson.loadData');
                done();
            }
        });

        /* eslint-disable no-new */
        new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined).load();
    });

    test('forwards geojson-vt options with worker request', done => {
        const mockDispatcher = wrapDispatcher({
            send(message, params) {
                expect(message).toBe('geojson.loadData');
                expect(params.geojsonVtOptions).toEqual({
                    extent: 8192,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256,
                    lineMetrics: false,
                    generateId: true
                });
                done();
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
            send(message, params) {
                expect(message).toBe('geojson.loadData');
                expect(params.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: 8192,
                    radius: 1600,
                    log: false,
                    generateId: true
                });
                done();
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

    test('forwards Supercluster options with worker request, ignore max zoom of source', done => {
        const mockDispatcher = wrapDispatcher({
            send(message, params) {
                expect(message).toBe('geojson.loadData');
                expect(params.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: 8192,
                    radius: 1600,
                    log: false,
                    generateId: true
                });
                done();
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
            send(message, args, callback) {
                if (callback) {
                    setTimeout(callback, 0);
                }
            }
        });

        const source = new GeoJSONSource('id', {data: {}} as GeoJSONSourceOptions, mockDispatcher, undefined);

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') done();
        });

        source.load();
    });

    test('fires "error"', done => {
        const mockDispatcher = wrapDispatcher({
            send(message, args, callback) {
                if (callback) {
                    setTimeout(callback.bind(null, 'error'), 0);
                }
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
            send(message, args, callback) {
                if (message === 'geojson.loadData' && --expectedLoadDataCalls <= 0) {
                    done();
                }
                if (callback) {
                    setTimeout(callback, 0);
                }
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
                source.loadTile(new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512), () => {});
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
