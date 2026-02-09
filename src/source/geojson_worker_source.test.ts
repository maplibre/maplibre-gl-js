import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createGeoJSONIndex, GeoJSONWorkerSource, type LoadGeoJSONParameters} from './geojson_worker_source';
import {StyleLayerIndex} from '../style/style_layer_index';
import {OverscaledTileID} from '../tile/tile_id';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Actor, type IActor} from '../util/actor';
import {type TileParameters, type WorkerTileParameters, type WorkerTileResult} from './worker_source';
import {setPerformance, sleep} from '../util/test/util';
import {type FakeServer, fakeServer} from 'nise';
import {GEOJSON_TILE_LAYER_NAME} from '@maplibre/vt-pbf';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import {type WorkerTile} from './worker_tile';

const actor = {send: () => {}} as any as Actor;

beforeEach(() => {
    setPerformance();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('geojson tile worker source', () => {
    const actor: IActor = {sendAsync: () => Promise.resolve({})} as any as IActor;

    test('GeoJSONWorkerSource.removeTile removes loaded tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);

        source.tileState.loaded = {
            '0': {} as WorkerTile
        };

        const res = await source.removeTile({
            source: 'source',
            uid: 0
        } as any as TileParameters);
        expect(res).toBeUndefined();

        expect(source.tileState.loaded).toEqual({});
    });

    test('GeoJSONWorkerSource.reloadTile reloads a previously-loaded tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = vi.fn().mockResolvedValue({} as WorkerTileResult);

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

        const result = await source.reloadTile({uid: 0} as any as WorkerTileParameters);

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

        const actor = {
            sendAsync: (message: {type: string; data: unknown}, abortController: AbortController) => {
                return new Promise((resolve, _reject) => {
                    const res = setTimeout(() => {
                        const response = message.type === 'getImages' ?
                            {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                            {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}};
                        resolve(response);
                    }, 100);
                    abortController.signal.addEventListener('abort', () => {
                        clearTimeout(res);
                    });
                });
            }
        };

        const source = new GeoJSONWorkerSource(actor as any, layerIndex, ['hello']);

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

        await source.loadData({source: 'source', data: geoJson} as LoadGeoJSONParameters);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters).then(() => expect(false).toBeTruthy());

        // allow promise to run
        await sleep(0);

        const res = await source.reloadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters);

        expect(res).toBeDefined();
        expect(res.rawTileData).toBeDefined();
    });

    test('GeoJSONWorkerSource.loadTile returns null for an empty tile', async () => {
        const source = new GeoJSONWorkerSource(actor, new StyleLayerIndex(), []);
        await source.loadData({source: 'source', data: {type: 'FeatureCollection', features: []}} as LoadGeoJSONParameters);

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
        } as any as WorkerTileParameters)).rejects.toThrowError(/Unable to parse the data into a cluster or geojson/);
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

        await source.loadData({source: 'sourceId', data: geoJson} as LoadGeoJSONParameters);

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
        await source.loadData({source: 'sourceId', data: geoJson} as LoadGeoJSONParameters);

        // should call loadVectorData again after changing geojson data
        data = await source.reloadTile(tileParams as any as WorkerTileParameters);
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

        await source.loadData({type: 'geojson', source: 'sourceId', data: geoJson} as LoadGeoJSONParameters);

        // load vector data from geojson, passing through the tile serialization step
        const data = await source.reloadTile(tileParams as any as WorkerTileParameters);
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
        source.loadGeoJSONFromUrl = () => Promise.resolve(geoJson);

        const result = await source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters);

        expect(result.resourceTiming.testSource).toEqual([exampleResourceTiming]);
    });

    test('loadData - url (resourceTiming fallback method)', async () => {
        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = vi.fn().mockImplementation((name) => { return measures[name] || []; });
        vi.spyOn(performance, 'mark').mockImplementation((name) => {
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
        vi.spyOn(performance, 'clearMarks').mockImplementation(() => { return null; });
        vi.spyOn(performance, 'clearMeasures').mockImplementation(() => { return null; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);
        source.loadGeoJSONFromUrl = () => Promise.resolve(geoJson);

        const result = await source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}} as LoadGeoJSONParameters);

        expect(result.resourceTiming.testSource).toEqual(
            [{'duration': 250, 'entryType': 'measure', 'name': 'http://localhost/nonexistent', 'startTime': 100}]
        );
    });

    test('loadData - data', async () => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, []);

        const result = await source.loadData({source: 'testSource', data: geoJson} as LoadGeoJSONParameters);
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

        await worker.loadData({source: 'source1', data: geoJson} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).rejects.toBeDefined();
    });

    test('loadData with geojson creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        await worker.loadData({source: 'source1', data: updateableGeoJson} as LoadGeoJSONParameters);
        await expect(worker.loadData({source: 'source1', dataDiff: {removeAll: true}} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData with geojson network call creates an updateable source', async () => {
        const worker = new GeoJSONWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify(updateableGeoJson));
        });

        const load1Promise = worker.loadData({source: 'source1', request: {url: ''}} as LoadGeoJSONParameters);
        server.respond();

        const result = await load1Promise;
        expect(result.data).toStrictEqual(updateableGeoJson);
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

        await worker.loadData({source: 'source1', data: updateableGeoJson} as LoadGeoJSONParameters);
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

        await worker.loadData({source: 'source1', data: updateableGeoJson} as LoadGeoJSONParameters);
        await expect(worker.loadData({} as LoadGeoJSONParameters)).resolves.toBeDefined();
    });

    test('loadData should process cluster change with no data', async () => {
        const mockCreateGeoJSONIndex = vi.fn(createGeoJSONIndex);
        const worker = new GeoJSONWorkerSource(actor, layerIndex, [], mockCreateGeoJSONIndex);

        await worker.loadData({source: 'source1', data: updateableFeatureCollection, cluster: false} as LoadGeoJSONParameters);
        expect(mockCreateGeoJSONIndex.mock.calls[0][1].cluster).toBe(false);
        await expect(worker.loadData({cluster: true} as LoadGeoJSONParameters)).resolves.toBeDefined();
        expect(mockCreateGeoJSONIndex.mock.calls[1][1].cluster).toBe(true);
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

        await worker.loadData({source: 'source1', data: geoJson} as LoadGeoJSONParameters);
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

        await worker.loadData({source: 'source1', data: updateableGeoJson} as LoadGeoJSONParameters);
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
