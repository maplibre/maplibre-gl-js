import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {GeoJSONWorkerSource, type LoadGeoJSONParameters} from './geojson_worker_source';
import {StyleLayerIndex} from '../style/style_layer_index';
import {OverscaledTileID} from './tile_id';
import perf from '../util/performance';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Actor} from '../util/actor';
import {type WorkerTileParameters} from './worker_source';
import {setPerformance, sleep} from '../util/test/util';
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
        const spy = vi.spyOn(source, 'loadVectorTile');
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

        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters);

        // first call should load vector data from geojson
        const firstData = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect(spy).toHaveBeenCalledTimes(1);

        // second call won't give us new rawTileData
        let data = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect('rawTileData' in data).toBeFalsy();
        data.rawTileData = firstData.rawTileData;
        expect(data).toEqual(firstData);

        // also shouldn't call loadVectorData again
        expect(spy).toHaveBeenCalledTimes(1);

        // replace geojson data
        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters);

        // should call loadVectorData again after changing geojson data
        data = await source.reloadTile(tileParams as any as WorkerTileParameters);
        expect('rawTileData' in data).toBeTruthy();
        expect(data).toEqual(firstData);
        expect(spy).toHaveBeenCalledTimes(2);
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

    test('loadData - url', async () => {
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

        window.performance.getEntriesByName = vi.fn().mockReturnValue([exampleResourceTiming]);

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);
        source.loadGeoJSON = () => Promise.resolve(geoJson);

        const result = await source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters);

        expect(result.resourceTiming.testSource).toEqual([exampleResourceTiming]);
    });

    test('loadData - url (resourceTiming fallback method)', async () => {
        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = vi.fn().mockImplementation((name) => { return measures[name] || []; });
        vi.spyOn(perf, 'mark').mockImplementation((name) => {
            marks[name] = sampleMarks.shift();
            return null;
        });
        window.performance.measure = vi.fn().mockImplementation((name, start, end) => {
            measures[name] = measures[name] || [];
            measures[name].push({
                duration: marks[end] - marks[start],
                entryType: 'measure',
                name,
                startTime: marks[start]
            });
            return null;
        });
        vi.spyOn(perf, 'clearMarks').mockImplementation(() => { return null; });
        vi.spyOn(perf, 'clearMeasures').mockImplementation(() => { return null; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);
        source.loadGeoJSON = () => Promise.resolve(geoJson);

        const result = await source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters);

        expect(result.resourceTiming.testSource).toEqual(
            [{'duration': 250, 'entryType': 'measure', 'name': 'http://localhost/nonexistent', 'startTime': 100}]
        );
    });

    test('loadData - data', async () => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        const result = await source.loadData({source: 'testSource', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters);
        expect(result.resourceTiming).toBeUndefined();
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
        return new GeoJSONWorkerSource(actor, layerIndex, []);
    }

    test('abandons previous requests', async () => {
        const worker = createWorker();

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });

        const p1 = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);
        await sleep(0);

        const p2 = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);

        await sleep(0);

        server.respond();

        const firstCallResult = await p1;
        expect(firstCallResult && firstCallResult.abandoned).toBeTruthy();
        const result = await p2;
        expect(result && result.abandoned).toBeFalsy();
    });

    test('removeSource aborts requests', async () => {
        const worker = createWorker();

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });

        const loadPromise = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);
        await sleep(0);
        const removePromise = worker.removeSource({source: 'source1', type: 'type'});
        await sleep(0);

        server.respond();

        const result = await loadPromise;
        expect(result && result.abandoned).toBeTruthy();
        await removePromise;
    });

    test('loadData with geojson creates an non-updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).rejects.toBeDefined();
    });

    test('loadData with geojson creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: JSON.stringify(updateableGeoJson)} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData with geojson network call creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(updateableGeoJson));
        });

        const load1Promise = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);
        server.respond();

        await load1Promise;
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData with geojson network call creates a non-updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });

        const promise = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);

        server.respond();

        await promise;

        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).rejects.toBeDefined();
    });

    test('loadData with diff updates', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: JSON.stringify(updateableGeoJson)} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {
            add: [{
                type: 'Feature',
                id: 'update_point',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }]
        }} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });
});

describe('getData', () => {
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

    test('getData returns correct geojson when the source was loaded with geojson', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: JSON.stringify(geoJson)} as LoadGeoJSONParameters);
        await expect(worker.getData()).resolves.toStrictEqual(geoJson);
    });

    test('getData after a geojson network call returns actual loaded geojson', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(updateableGeoJson));
        });

        const load1Promise = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);
        server.respond();

        await load1Promise;
        await expect(worker.getData()).resolves.toStrictEqual(updateableGeoJson);
    });

    test('getData after diff updates returns updated geojson', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: JSON.stringify(updateableGeoJson)} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {
            add: [{
                type: 'Feature',
                id: 'update_point',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }]
        }} as LoadGeoJSONParameters)).resolves.toBeDefined();

        await expect(worker.getData()).resolves.toStrictEqual({
            type: 'FeatureCollection',
            features: [
                {...updateableGeoJson},
                {
                    type: 'Feature',
                    id: 'update_point',
                    geometry: {type: 'Point', coordinates: [0, 0]},
                    properties: {}
                }
            ]
        });
    });
});
