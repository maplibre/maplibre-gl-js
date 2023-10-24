import {GeoJSONWorkerSource, LoadGeoJSONParameters} from './geojson_worker_source';
import {StyleLayerIndex} from '../style/style_layer_index';
import {OverscaledTileID} from './tile_id';
import perf from '../util/performance';
import {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {Actor} from '../util/actor';
import {WorkerTileParameters} from './worker_source';
import {setPerformance} from '../util/test/util';
import {type FakeServer, fakeServer} from 'nise';

const actor = {send: () => {}} as any as Actor;

beforeEach(() => {
    setPerformance();
});

describe('reloadTile', () => {
    test('does not rebuild vector data unless data has changed', async () => {
        const layers = [
            {
                id: 'mylayer',
                source: 'sourceId',
                type: 'symbol',
            }
        ] as LayerSpecification[];
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);
        const originalLoadVectorData = source.loadVectorData;
        let loadVectorCallCount = 0;
        source.loadVectorData = function(params, callback) {
            loadVectorCallCount++;
            return originalLoadVectorData.call(this, params, callback);
        };
        const geoJson = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [0, 0]
            }
        };
        const tileParams = {
            source: 'sourceId',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            maxZoom: 10
        };

        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters)

            // first call should load vector data from geojson
        let firstData = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect(loadVectorCallCount).toBe(1);

        // second call won't give us new rawTileData
        let data = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect('rawTileData' in data).toBeFalsy();
        data.rawTileData = firstData.rawTileData;
        expect(data).toEqual(firstData);

        // also shouldn't call loadVectorData again
        expect(loadVectorCallCount).toBe(1);

        // replace geojson data
        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters)
            
        // should call loadVectorData again after changing geojson data
        data = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect('rawTileData' in data).toBeTruthy();
        expect(data).toEqual(firstData);
        expect(loadVectorCallCount).toBe(2);
    });

});

describe('resourceTiming', () => {

    const layers = [
        {
            id: 'mylayer',
            source: 'sourceId',
            type: 'symbol',
        }
    ] as LayerSpecification[];
    const geoJson = {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': [0, 0]
        }
    } as GeoJSON.GeoJSON;

    test('loadData - url', done => {
        const exampleResourceTiming = {
            connectEnd: 473,
            connectStart: 473,
            decodedBodySize: 86494,
            domainLookupEnd: 473,
            domainLookupStart: 473,
            duration: 341,
            encodedBodySize: 52528,
            entryType: 'resource',
            fetchStart: 473.5,
            initiatorType: 'xmlhttprequest',
            name: 'http://localhost:2900/fake.geojson',
            nextHopProtocol: 'http/1.1',
            redirectEnd: 0,
            redirectStart: 0,
            requestStart: 477,
            responseEnd: 815,
            responseStart: 672,
            secureConnectionStart: 0
        } as any as PerformanceEntry;

        window.performance.getEntriesByName = jest.fn().mockReturnValue([exampleResourceTiming]);

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], (params, callback) => {
            callback(null, geoJson);
            return {cancel: () => {}};
        });

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters)
            .then((result) => {
                expect(result.resourceTiming.testSource).toEqual([exampleResourceTiming]);
                done();
            }).catch(() => expect(false).toBeTruthy());
    });

    test('loadData - url (resourceTiming fallback method)', done => {
        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = jest.fn().mockImplementation((name) => { return measures[name] || []; });
        jest.spyOn(perf, 'mark').mockImplementation((name) => {
            marks[name] = sampleMarks.shift();
            return null;
        });
        window.performance.measure = jest.fn().mockImplementation((name, start, end) => {
            measures[name] = measures[name] || [];
            measures[name].push({
                duration: marks[end] - marks[start],
                entryType: 'measure',
                name,
                startTime: marks[start]
            });
            return null;
        });
        jest.spyOn(perf, 'clearMarks').mockImplementation(() => { return null; });
        jest.spyOn(perf, 'clearMeasures').mockImplementation(() => { return null; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], (params, callback) => {
            callback(null, geoJson);
            return {cancel: () => {}};
        });

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters)
            .then((result) => {
                expect(result.resourceTiming.testSource).toEqual(
                    [{'duration': 250, 'entryType': 'measure', 'name': 'http://localhost/nonexistent', 'startTime': 100}]
                );
                done();
            }).catch(() => expect(false).toBeTruthy());
    });

    test('loadData - data', done => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        source.loadData({source: 'testSource', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters)
            .then((result) => {
                expect(result.resourceTiming).toBeUndefined();
                done();
            }).catch(() => expect(false).toBeTruthy());
    });

});

describe('loadData', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
    });

    const layers = [
        {
            id: 'layer1',
            source: 'source1',
            type: 'symbol',
        },
        {
            id: 'layer2',
            source: 'source2',
            type: 'symbol',
        }
    ] as LayerSpecification[];

    const geoJson = {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': [0, 0]
        }
    } as GeoJSON.GeoJSON;

    const updateableGeoJson = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0],
        },
        properties: {},
    } as GeoJSON.GeoJSON;

    const layerIndex = new StyleLayerIndex(layers);
    function createWorker() {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        // Making the call to loadGeoJSON asynchronous
        // allows these tests to mimic a message queue building up
        // (regardless of timing)
        const originalLoadGeoJSON = worker.loadGeoJSON;
        worker.loadGeoJSON = function(params, callback) {
            const timeout = setTimeout(() => {
                originalLoadGeoJSON(params, callback);
            }, 0);

            return {cancel: () => clearTimeout(timeout)};
        };
        return worker;
    }

    test('abandons previous callbacks', done => {
        const worker = createWorker();
        let firstCallbackHasRun = false;

        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters).then((result) => {
            expect(result && result.abandoned).toBeTruthy();
            firstCallbackHasRun = true;
        }).catch(() => expect(false).toBeTruthy());

        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters).then((result) => {
            expect(result && result.abandoned).toBeFalsy();
            expect(firstCallbackHasRun).toBeTruthy();
            done();
        }).catch(() => expect(false).toBeTruthy());
    });

    test('removeSource aborts callbacks', done => {
        const worker = createWorker();
        let loadDataCallbackHasRun = false;
        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters).then((result) => {
            expect(result && result.abandoned).toBeTruthy();
            loadDataCallbackHasRun = true;
        }).catch(() => expect(false).toBeTruthy());

        worker.removeSource({source: 'source1', type: 'type'}).then(() => {
            // Allow promsie to resolve
            setTimeout(() => {
                expect(loadDataCallbackHasRun).toBeTruthy();
                done();
            }, 0);
        }).catch(() => expect(false).toBeTruthy());
    });

    test('loadData with geojson creates an non-updateable source', done => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters).then(() => {
            worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters).catch((err) => {
                expect(err).toBeDefined();
                done();
            }).catch(() => expect(false).toBeTruthy());
        });
    });

    test('loadData with geojson creates an updateable source', done => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        worker.loadData({source: 'source1', data: JSON.stringify(updateableGeoJson)} as LoadGeoJSONParameters).then(() => {
            worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters).then(() => {
                done();
            }).catch(() => expect(false).toBeTruthy());
        }).catch(() => expect(false).toBeTruthy());
    });

    test('loadData with geojson network call creates an updateable source', done => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(updateableGeoJson));
        });

        worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters).then(() => {
            worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters).then(() => {
                done();
            }).catch(() => expect(false).toBeTruthy());
        }).catch(() => expect(false).toBeTruthy());

        server.respond();
    });

    test('loadData with geojson network call creates a non-updateable source', done => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });

        worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters).then(() => {
            worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)
                .then(() => expect(false).toBeTruthy())
                .catch((err) => {
                    expect(err).toBeDefined();
                    done();
                });
        }).catch(() => expect(false).toBeTruthy());

        server.respond();
    });

    test('loadData with diff updates', done => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        worker.loadData({source: 'source1', data: JSON.stringify(updateableGeoJson)} as LoadGeoJSONParameters).then(() => {
            worker.loadData({source: 'source1', dataDiff: {
                add: [{
                    type: 'Feature',
                    id: 'update_point',
                    geometry: {type: 'Point', coordinates: [0, 0]},
                    properties: {}
                }]}} as LoadGeoJSONParameters).then(() => {
                done();
            }).catch(() => expect(false).toBeTruthy());
        }).catch(() => expect(false).toBeTruthy());
    });
});
