import GeoJSONWorkerSource, {LoadGeoJSONParameters} from './geojson_worker_source';
import StyleLayerIndex from '../style/style_layer_index';
import {OverscaledTileID} from './tile_id';
import perf from '../util/performance';
import {LayerSpecification} from '../style-spec/types.g';
import Actor from '../util/actor';
import {WorkerTileParameters} from './worker_source';
import {setPerformance} from '../util/test/util';

const actor = {send: () => {}} as any as Actor;

beforeEach(() => {
    setPerformance();
});

describe('reloadTile', () => {
    test('does not rebuild vector data unless data has changed', done => {
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

        function addData(callback) {
            source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters, (err) => {
                expect(err).toBeNull();
                callback();
            });
        }

        function reloadTile(callback) {
            source.reloadTile(tileParams as any as WorkerTileParameters, (err, data) => {
                expect(err).toBeNull();
                return callback(data);
            });
        }

        addData(() => {
            // first call should load vector data from geojson
            let firstData;
            reloadTile(data => {
                firstData = data;
            });
            expect(loadVectorCallCount).toBe(1);

            // second call won't give us new rawTileData
            reloadTile(data => {
                expect('rawTileData' in data).toBeFalsy();
                data.rawTileData = firstData.rawTileData;
                expect(data).toEqual(firstData);
            });

            // also shouldn't call loadVectorData again
            expect(loadVectorCallCount).toBe(1);

            // replace geojson data
            addData(() => {
                // should call loadVectorData again after changing geojson data
                reloadTile(data => {
                    expect('rawTileData' in data).toBeTruthy();
                    expect(data).toEqual(firstData);
                });
                expect(loadVectorCallCount).toBe(2);
                done();
            });
        });
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

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result.resourceTiming.testSource).toEqual([exampleResourceTiming]);
            done();
        });
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

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result.resourceTiming.testSource).toEqual(
                [{'duration': 250, 'entryType': 'measure', 'name': 'http://localhost/nonexistent', 'startTime': 100}]
            );
            done();
        });
    });

    test('loadData - data', done => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        source.loadData({source: 'testSource', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result.resourceTiming).toBeUndefined();
            done();
        });
    });

});

describe('loadData', () => {
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

        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result && result.abandoned).toBeTruthy();
            firstCallbackHasRun = true;
        });

        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result && result.abandoned).toBeFalsy();
            expect(firstCallbackHasRun).toBeTruthy();
            done();
        });
    });

    test('removeSource aborts callbacks', done => {
        const worker = createWorker();
        let loadDataCallbackHasRun = false;
        worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters, (err, result) => {
            expect(err).toBeNull();
            expect(result && result.abandoned).toBeTruthy();
            loadDataCallbackHasRun = true;
        });

        worker.removeSource({source: 'source1'}, (err) => {
            expect(err).toBeFalsy();
            expect(loadDataCallbackHasRun).toBeTruthy();
            done();
        });

    });

});
