import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {GEOJSON_TILE_LAYER_NAME} from '@maplibre/vt-pbf';
import {GeoJSONWorkerSource, type LoadGeoJSONParameters} from './geojson_worker_source.ts';
import {StyleLayerIndex} from '../style/style_layer_index.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createFakeActor, setPerformance, sleep} from '../util/test/util.ts';
import {type FakeServer, fakeServer} from 'nise';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {setProjectionHandler, type ProjectionHandler} from './projection_handler_worker.ts';
import {identityCrs} from '../geo/projection/crs.ts';

import type {GeoJSONVT} from '@maplibre/geojson-vt';
import type {Actor, IActor} from '../util/actor.ts';
import type {TileParameters, WorkerTileParameters, WorkerTileResult, WorkerTileWithData} from './worker_source.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {WorkerTile} from './worker_tile.ts';

const actor = {send: () => {}} as any as Actor;

describe('geojson tile worker source', () => {
    const actor: IActor = {sendAsync: () => Promise.resolve({})};

    test('GeoJSONWorkerSource.removeTile removes loaded tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);

        source.tileState.loaded = {
            '0': {} as WorkerTile
        };

        await source.removeTile({
            source: 'source',
            uid: 0
        } as any as TileParameters);

        expect(source.tileState.loaded).toEqual({});
    });

    test('GeoJSONWorkerSource.reloadTile reloads a previously-loaded tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = vi.fn().mockResolvedValue({});

        source.tileState.loaded = {
            '0': {
                status: 'done',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        const reloadPromise = source.reloadTile({uid: 0} as any as WorkerTileParameters);
        expect(parse).toHaveBeenCalledTimes(1);
        await expect(reloadPromise).resolves.toBeTruthy();
    });

    test('GeoJSONWorkerSource.reloadTile returns parse result without rawTileData when parsing state was already consumed', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        const parseResult = {buckets: []} as any as WorkerTileResult;
        const parse = vi.fn().mockResolvedValue(parseResult);

        source.tileState.loaded = {
            '0': {
                status: 'parsing',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        const result = await source.reloadTile({uid: 0} as any as WorkerTileParameters) as WorkerTileWithData;

        expect(parse).toHaveBeenCalledTimes(1);
        expect(result).toBe(parseResult);
        expect(result.rawTileData).toBeUndefined();
    });

    test('GeoJSONWorkerSource.loadTile reparses tile if reloadTile has been called during parsing', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': '_geojsonTileLayer',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        const actor = createFakeActor();

        const source = new GeoJSONWorkerSource(actor, layerIndex, ['hello']);

        const geoJson = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 1,
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {
                    name: 'test'
                }
            }]
        } as GeoJSON.GeoJSON;

        await source.loadData({source: 'source', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        const onSettled = vi.fn();
        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters).then(onSettled, onSettled);

        // allow promise to run
        await sleep(0);

        const res = await source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters) as WorkerTileWithData;

        expect(onSettled).not.toHaveBeenCalled();
        expect(res).toBeDefined();
        expect(res.rawTileData).toBeDefined();
    });

    test('GeoJSONWorkerSource.reloadTile during loadTile returns data even if interrupted by another reloadTile', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': '_geojsonTileLayer',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        const actor = createFakeActor();

        const source = new GeoJSONWorkerSource(actor, layerIndex, ['hello']);

        const geoJson = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 1,
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {
                    name: 'test'
                }
            }]
        } as GeoJSON.GeoJSON;

        await source.loadData({source: 'source', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        const onSettled = vi.fn();
        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters).then(onSettled, onSettled);

        // allow promise to run
        await sleep(0);

        source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters);

        const res = await source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters) as WorkerTileWithData;

        expect(onSettled).not.toHaveBeenCalled();
        expect(res).toBeDefined();
        expect(res.rawTileData).toBeDefined();
    });

    test('GeoJSONWorkerSource.reloadTile should include rawTileData in result when loadTile and reloadTile were aborted', async () => {
        // Simulates scenario where loadTile + reloadTile + reloadTile all fire before the previous call can resolve

        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': '_geojsonTileLayer',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        let sendAsyncShouldAbort = false;
        const actor = createFakeActor(() => sendAsyncShouldAbort);

        // Step 1: Create source and load data
        const source = new GeoJSONWorkerSource(actor, layerIndex, ['hello']);
        const geoJson = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 1,
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                properties: {
                    name: 'test'
                }
            }]
        } as GeoJSON.GeoJSON;
        await source.loadData({source: 'source', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        // Step 2: Call loadTile and have it abort
        sendAsyncShouldAbort = true;
        await expect(source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters)).rejects.toThrow(/aborted/);

        // Step 3: Call reloadTile and have it abort
        sendAsyncShouldAbort = true;
        await expect(source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters)).rejects.toThrow(/aborted/);

        // Step 4: Call reloadTile
        sendAsyncShouldAbort = false;
        const res = await source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters) as WorkerTileWithData;

        expect(res).toBeDefined();
        expect(res.rawTileData).toBeDefined();
    });

    test('GeoJSONWorkerSource.loadTile returns null for an empty tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: {type: 'FeatureCollection', features: []}, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        const result = await source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        } as any as WorkerTileParameters);

        expect(result).toBeNull();
    });

    test('GeoJSONWorkerSource.loadTile throws error when data has not been loaded', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);

        await expect(source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        } as any as WorkerTileParameters)).rejects.toThrow(/Unable to parse the data into a cluster or geojson/);
    });

    test('GeoJSONWorkerSource.abortTile aborts tile state', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        const abortSpy = vi.spyOn(source.tileState, 'abort');

        await source.abortTile({
            source: 'source',
            uid: 0
        } as any as TileParameters);

        expect(abortSpy).toHaveBeenCalledWith(0);
    });
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

        await source.loadData({source: 'sourceId', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        // first call should load vector data from geojson
        const firstData = await source.reloadTile(tileParams as any as WorkerTileParameters) as WorkerTileWithData;
        expect(spy).toHaveBeenCalledTimes(1);

        // second call won't give us new rawTileData
        let data = await source.reloadTile(tileParams as any as WorkerTileParameters) as WorkerTileWithData;
        expect('rawTileData' in data).toBeFalsy();
        data.rawTileData = firstData.rawTileData;
        data.encoding = 'mvt';
        expect(data).toEqual(firstData);

        // also shouldn't call loadVectorData again
        expect(spy).toHaveBeenCalledTimes(1);

        // replace geojson data
        await source.loadData({source: 'sourceId', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        // should call loadVectorData again after changing geojson data
        data = await source.reloadTile(tileParams as any as WorkerTileParameters) as WorkerTileWithData;
        expect('rawTileData' in data).toBeTruthy();
        expect(data).toEqual(firstData);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    test('handles null and undefined properties during tile serialization', async () => {
        const layers = [
            {
                id: 'mylayer',
                source: 'sourceId',
                type: 'symbol',
            }
        ] as LayerSpecification[];
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);
        const geoJson = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [0, 0]
            },
            'properties': {
                'nullProperty': null,
                'undefinedProperty': undefined,
                'stringProperty': 'string'
            }
        };
        const tileParams = {
            source: 'sourceId',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            maxZoom: 10
        };

        await source.loadData({type: 'geojson', source: 'sourceId', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        // load vector data from geojson, passing through the tile serialization step
        const data = await source.reloadTile(tileParams as any as WorkerTileParameters) as WorkerTileWithData;
        expect(data.featureIndex).toBeDefined();

        // deserialize tile layers in the feature index
        data.featureIndex.rawTileData = data.rawTileData;
        const featureLayers = data.featureIndex.loadVTLayers();
        expect(Object.keys(featureLayers)).toHaveLength(1);

        // validate supported features are present in the index
        expect(featureLayers[GEOJSON_TILE_LAYER_NAME].feature(0).properties['stringProperty']).toBeDefined();
    });
});

describe('resourceTiming', () => {
    let server: FakeServer;
    beforeEach(() => {
        setPerformance();
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
        vi.clearAllMocks();
    });

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
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });
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

        const promise = source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        server.respond();
        const result = await promise;

        expect(result.resourceTiming.testSource).toEqual([exampleResourceTiming]);
    });

    test('loadData - url (resourceTiming fallback method)', async () => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(geoJson));
        });
        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = vi.fn().mockImplementation((name) => measures[name] || []);
        vi.spyOn(performance, 'mark').mockImplementation((name) => {
            marks[name] = sampleMarks.shift();
            return null;
        });
        window.performance.measure = vi.fn().mockImplementation((name, start, end) => {
            measures[name] ||= [];
            measures[name].push({
                duration: marks[end] - marks[start],
                entryType: 'measure',
                name,
                startTime: marks[start]
            });
            return null;
        });
        vi.spyOn(performance, 'clearMarks').mockReturnValue(null);
        vi.spyOn(performance, 'clearMeasures').mockReturnValue(null);

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        const promise = source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        server.respond();
        const result = await promise;

        expect(result.resourceTiming.testSource).toEqual(
            [{'duration': 250, 'entryType': 'measure', 'name': 'http://localhost/nonexistent', 'startTime': 100}]
        );
    });

    test('loadData - data', async () => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        const result = await source.loadData({source: 'testSource', data: geoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        expect(result.resourceTiming).toBeUndefined();
        expect(result.data).toBeUndefined();
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

    const updateableFeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 'point1',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0],
                },
                properties: {},
            },
            {
                type: 'Feature',
                id: 'point2',
                geometry: {
                    type: 'Point',
                    coordinates: [1, 1],
                },
                properties: {},
            }
        ]
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

        const p1 = worker.loadData({source: 'source1', request: {url: ''}, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        await sleep(0);

        const p2 = worker.loadData({source: 'source1', request: {url: ''}, geojsonVtOptions: {}} as LoadGeoJSONParameters);

        await sleep(0);

        server.respond();

        const firstCallResult = await p1;
        expect(firstCallResult?.abandoned).toBeTruthy();
        const result = await p2;
        expect(result?.abandoned).toBeFalsy();
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
        expect(result?.abandoned).toBeTruthy();
        await removePromise;
    });

    test('loadData with geojson creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: updateableGeoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}, geojsonVtOptions: {}} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData with geojson network call creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(updateableGeoJson));
        });

        const load1Promise = worker.loadData({source: 'source1', request: {url: ''}, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        server.respond();

        const result = await load1Promise;
        expect(result.data).toStrictEqual(updateableGeoJson);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData with diff updates', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: updateableGeoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        const result = await worker.loadData({source: 'source1', dataDiff: {
            add: [{
                type: 'Feature',
                id: 'update_point',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }]
        }} as LoadGeoJSONParameters);
        expect(result).toBeDefined();
        expect(result.data).toBeUndefined();
    });

    test('loadData should reject as first call with no data', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await expect(worker.loadData({} as LoadGeoJSONParameters)).rejects.toBeDefined();
    });

    test('loadData should resolve as subsequent call with no data', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: updateableGeoJson, geojsonVtOptions: {}} as LoadGeoJSONParameters);
        await expect(worker.loadData({} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData should process cluster change after the diff sent with it and build relevant map and reduce methods', async () => {
        const updateDataSpy = vi.fn();
        const updateSpy = vi.fn();
        const mockGeoJSONIndex = {
            updateData: updateDataSpy,
            updateClusterOptions: updateSpy
        } as any as GeoJSONVT;
        const worker = new GeoJSONWorkerSource(actor, layerIndex, [], () => mockGeoJSONIndex);
        await worker.loadData({source: 'source1', data: updateableFeatureCollection, geojsonVtOptions: {cluster: false}} as LoadGeoJSONParameters);
        expect(mockGeoJSONIndex.updateClusterOptions).not.toHaveBeenCalled();
        await expect(worker.loadData({
            type: 'geojson',
            source: 'source1',
            dataDiff: {removeAll: true},
            updateCluster: true,
            geojsonVtOptions: {
                cluster: true,
                clusterOptions: {},
            },
            clusterProperties: {
                'max': ['max', ['get', 'scalerank']],
                'sum': ['+', ['get', 'scalerank']],
            }
        })).resolves.toBeDefined();
        expect(updateSpy).toHaveBeenCalled();
        expect(updateDataSpy.mock.invocationCallOrder[0]).toBeLessThan(updateSpy.mock.invocationCallOrder[0]);
        expect(updateSpy.mock.calls[0][1].map).toBeInstanceOf(Function);
        expect(updateSpy.mock.calls[0][1].reduce).toBeInstanceOf(Function);
    });
});

describe('loadData in a registered projection', () => {
    const pointAt45 = {type: 'Feature', id: 'p', properties: {}, geometry: {type: 'Point', coordinates: [45, 45]}} as GeoJSON.Feature;
    const identityParameters = {name: 'identity', tileMatrixSet: identityCrs.tileMatrixSet};
    const planarParameters = {name: 'EPSG:test', definition: 'PROJCS["test"]', tileMatrixSet: {origin: [-1000, 1000], extentAtZoom0: 2000}};

    afterEach(() => {
        setProjectionHandler(null);
        vi.restoreAllMocks();
    });

    function firstFeatureInRootTile(source: GeoJSONWorkerSource) {
        const {vectorTile} = source.loadVectorTile({tileID: new OverscaledTileID(0, 0, 0, 0, 0)} as WorkerTileParameters);
        return vectorTile.layers[GEOJSON_TILE_LAYER_NAME].feature(0);
    }

    function featureCountInRootTile(source: GeoJSONWorkerSource) {
        const result = source.loadVectorTile({tileID: new OverscaledTileID(0, 0, 0, 0, 0)} as WorkerTileParameters);
        return result?.vectorTile.layers[GEOJSON_TILE_LAYER_NAME]?.length ?? 0;
    }

    test('tiles the data where the built-in identity projection puts it', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);

        expect(firstFeatureInRootTile(source).loadGeometry()[0][0]).toMatchObject({x: 3072, y: 1024});
    });

    test('tiles the data where the projection handler puts it', async () => {
        setProjectionHandler(() => ({forward: ([lng, lat]) => [lng * 10, lat * 10], inverse: ([x, y]) => [x / 10, y / 10]}));
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: planarParameters} as LoadGeoJSONParameters);

        expect(firstFeatureInRootTile(source).loadGeometry()[0][0]).toMatchObject({x: 2970, y: 1126});
    });

    test('calls the projection handler once for data loaded twice in the same projection', async () => {
        const handler = vi.fn<ProjectionHandler>(() => ({forward: ([lng, lat]) => [lng * 10, lat * 10], inverse: ([x, y]) => [x / 10, y / 10]}));
        setProjectionHandler(handler);
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: planarParameters} as LoadGeoJSONParameters);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: planarParameters} as LoadGeoJSONParameters);

        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('warns about a definition that no projection handler can project', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: planarParameters} as LoadGeoJSONParameters);

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('no projection handler is set in the workers'));
    });

    test('tiles the data as lng/lat when no projection handler can project its definition', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: planarParameters} as LoadGeoJSONParameters);

        expect(firstFeatureInRootTile(source).loadGeometry()[0][0]).toMatchObject({x: 2560, y: 1473});
    });

    test('tiles a feature a diff adds to a source without data where the projection puts it', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', dataDiff: {add: [pointAt45]}, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);

        expect(firstFeatureInRootTile(source).loadGeometry()[0][0]).toMatchObject({x: 3072, y: 1024});
    });

    test('leaves out points outside the grid square instead of wrapping them around or clamping them onto its top edge', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        const eastOfTheSquare = {...pointAt45, id: 'east', geometry: {type: 'Point', coordinates: [135, 45]}} as GeoJSON.Feature;
        const northOfTheSquare = {...pointAt45, id: 'north', geometry: {type: 'Point', coordinates: [45, 135]}} as GeoJSON.Feature;
        const data = {type: 'FeatureCollection', features: [pointAt45, eastOfTheSquare, northOfTheSquare]} as GeoJSON.FeatureCollection;
        await source.loadData({source: 'source', data, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);

        expect(featureCountInRootTile(source)).toBe(1);
    });

    test('removes a feature from the tiles when a diff moves it out of the grid square', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: pointAt45, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);
        await source.loadData({source: 'source', dataDiff: {update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [135, 45]}}]}, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);

        expect(featureCountInRootTile(source)).toBe(0);
    });

    test('draws a feature again, with its properties, when a diff moves it back into the grid square', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        const namedPoint = {...pointAt45, properties: {name: 'p'}} as GeoJSON.Feature;
        await source.loadData({source: 'source', data: namedPoint, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);
        await source.loadData({source: 'source', dataDiff: {update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [135, 45]}}]}, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);
        await source.loadData({source: 'source', dataDiff: {update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [45, 45]}}]}, geojsonVtOptions: {}, crs: identityParameters} as LoadGeoJSONParameters);

        expect(firstFeatureInRootTile(source).properties).toEqual({name: 'p'});
    });

    test('returns cluster leaves in lng/lat', async () => {
        const source = new GeoJSONWorkerSource(createFakeActor(), new StyleLayerIndex(), []);
        const twoPointsAt45 = {type: 'FeatureCollection', features: [pointAt45, {...pointAt45, id: 'q'}]} as GeoJSON.FeatureCollection;
        await source.loadData({source: 'source', data: twoPointsAt45, geojsonVtOptions: {cluster: true, clusterOptions: {}}, crs: identityParameters} as LoadGeoJSONParameters);
        const clusterId = firstFeatureInRootTile(source).properties.cluster_id as number;

        const leaves = source.getClusterLeaves({clusterId, limit: 10, offset: 0});

        expect((leaves[0].geometry as GeoJSON.Point).coordinates).toEqual([expect.closeTo(45, 9), expect.closeTo(45, 9)]);
    });
});
