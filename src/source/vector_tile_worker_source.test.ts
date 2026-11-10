import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import fs from 'fs';
import path from 'path';
import {PbfReader} from 'pbf';
import {VectorTileWorkerSource} from '../source/vector_tile_worker_source.ts';
import {StyleLayerIndex} from '../style/style_layer_index.ts';
import {fakeServer, type FakeServer} from 'nise';
import {WorkerTile} from './worker_tile.ts';
import {createFakeActor, setPerformance, sleep} from '../util/test/util.ts';
import {ABORT_ERROR} from '../util/abort_error.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {OverscaledTileID, CanonicalTileID} from '../tile/tile_id.ts';
import {VectorTile} from '@mapbox/vector-tile';

import type {TileParameters, WorkerTileParameters, WorkerTileResult, WorkerTileWithData} from './worker_source.ts';
import type {IActor} from '../util/actor.ts';

/** Reads a tile fixture into an `ArrayBuffer` of the test's realm, which the fake server accepts as a response body. */
function readTileFixture(file: string): ArrayBuffer {
    const data = fs.readFileSync(path.join(__dirname, '../../test/unit/assets', file));
    const body = new ArrayBuffer(data.byteLength);
    new Uint8Array(body).set(data);
    return body;
}

/** A symbol layer on the fixture's `place_label` features, whose icons and glyphs make parsing wait on the actor. */
function createPlaceLabelLayerIndex(): StyleLayerIndex {
    return new StyleLayerIndex([{
        id: 'place_label',
        source: 'source',
        'source-layer': 'place_label',
        type: 'symbol',
        layout: {
            'icon-image': 'hello',
            'text-font': ['StandardFont-Bold'],
            'text-field': '{name}'
        }
    }]);
}

describe('vector tile worker source', () => {
    const actor = {sendAsync: () => Promise.resolve({})} as IActor;
    let server: FakeServer;

    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        setPerformance();
    });

    afterEach(() => {
        server.restore();
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });
    test('VectorTileWorkerSource.abortTile aborts pending request', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        const loadPromise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/abort'}
        } as WorkerTileParameters);

        const abortPromise = source.abortTile({
            source: 'source',
            uid: 0
        } as TileParameters);

        await expect(abortPromise).resolves.toBeFalsy();
        await expect(loadPromise).rejects.toThrow(expect.objectContaining({name: ABORT_ERROR}));
    });

    test('VectorTileWorkerSource.removeTile removes loaded tile', async () => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, new ArrayBuffer(0) as any);
        });
        server.autoRespond = true;
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/faketile.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as WorkerTileParameters;
        await source.loadTile(params);

        await source.removeTile({source: 'source', uid: 0} as TileParameters);

        await expect(source.reloadTile(params)).rejects.toThrow(/never loaded or has been removed/);
    });

    test('VectorTileWorkerSource.reloadTile parses the tile for the world copy it is reloaded in', async () => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, '');
        });
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/faketile.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as WorkerTileParameters;
        const loadPromise = source.loadTile(params);
        server.respond();
        await loadPromise;
        const tileID = new OverscaledTileID(0, 1, 0, 0, 0);

        const result = await source.reloadTile({...params, tileID}) as WorkerTileWithData;

        expect(result.featureIndex.tileID).toEqual(tileID);
    });

    test('VectorTileWorkerSource keeps the etag across reloadTile so the next expiry refresh can return unmodified', async () => {
        const layerIndex = new StyleLayerIndex([{
            id: 'water',
            source: 'source',
            'source-layer': 'water',
            type: 'fill'
        }]);
        const source = new VectorTileWorkerSource(actor, layerIndex, []);

        server.respondWith(request => {
            request.respond(200, {
                'Content-Type': 'application/pbf',
                'ETag': '"v1"',
                'Cache-Control': 'max-age=300'
            }, readTileFixture('mbsv5-6-18-23.vector.pbf') as any);
        });

        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(6, 0, 6, 18, 23),
            request: {url: 'http://localhost:2900/faketile.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as WorkerTileParameters;

        const loadPromise = source.loadTile(params);
        server.respond();
        const loadResult = await loadPromise;
        const reloadResult = await source.reloadTile(params);
        const paramsWithEtagKeptFromReload = {...params, etag: reloadResult.etag};
        const expiryRefreshPromise = source.loadTile(paramsWithEtagKeptFromReload);
        server.respond();
        const expiryRefreshResult = await expiryRefreshPromise;

        expect(loadResult.etag).toBe('"v1"');
        expect(loadResult.cacheControl).toBe('max-age=300');
        expect(reloadResult.etag).toBe('"v1"');
        expect(reloadResult.cacheControl).toBeUndefined();
        expect(expiryRefreshResult.etagUnmodified).toBe(true);
    });

    test('VectorTileWorkerSource.reloadTile during parsing waits for the reparse and returns the raw tile data', async () => {
        const rawTileData = readTileFixture('mbsv5-6-18-23.vector.pbf');
        const source = new VectorTileWorkerSource(createFakeActor(), createPlaceLabelLayerIndex(), ['hello']);
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, rawTileData as any);
        });
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(6, 0, 6, 18, 23),
            request: {url: 'http://localhost:2900/faketile.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as WorkerTileParameters;

        const onSettled = vi.fn();
        source.loadTile(params).then(onSettled, onSettled);
        server.respond();
        await sleep(0);

        const res = await source.reloadTile(params) as WorkerTileWithData;

        expect(onSettled).not.toHaveBeenCalled();
        expect(res.rawTileData).toStrictEqual(rawTileData);
    });

    test('VectorTileWorkerSource.reloadTile includes rawTileData in response if loadTile was aborted', async () => {
        const rawTileData = readTileFixture('mbsv5-6-18-23.vector.pbf');
        let sendAsyncShouldAbort = false;
        const source = new VectorTileWorkerSource(createFakeActor(() => sendAsyncShouldAbort), createPlaceLabelLayerIndex(), ['hello']);
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, rawTileData as any);
        });
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(6, 0, 6, 18, 23),
            request: {url: 'http://localhost:2900/faketile.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as WorkerTileParameters;

        sendAsyncShouldAbort = true;
        const loadTilePromise = source.loadTile(params);
        server.respond();
        await expect(loadTilePromise).rejects.toThrow(/aborted/);

        sendAsyncShouldAbort = false;
        const res = await source.reloadTile(params) as WorkerTileWithData;

        expect(res.rawTileData).toStrictEqual(rawTileData);
    });

    test('VectorTileWorkerSource.loadTile reparses tile if reloadTile is called during reparsing', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);
        const parseWorkerTileMock = vi
            .spyOn(WorkerTile.prototype, 'parse')
            .mockImplementation(async () => {
                await sleep(20);
                return {} as WorkerTileResult;
            });
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, new ArrayBuffer(0) as any);
        });
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as WorkerTileParameters;

        const loadPromise = source.loadTile(params);
        server.respond();
        await sleep(0);

        const res = await source.reloadTile(params);

        expect(res).toBeDefined();
        expect(parseWorkerTileMock).toHaveBeenCalledTimes(2);
        await expect(loadPromise).resolves.toBeTruthy();
    });

    test('VectorTileWorkerSource.reloadTile during loadTile returns data even if interrupted by another reloadTile', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);
        const parseWorkerTileMock = vi
            .spyOn(WorkerTile.prototype, 'parse')
            .mockImplementation(async () => {
                await sleep(20);
                return {} as WorkerTileResult;
            });
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, new ArrayBuffer(0) as any);
        });
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as WorkerTileParameters;

        const loadPromise = source.loadTile(params);
        server.respond();
        await sleep(0);

        source.reloadTile(params);
        const res = await source.reloadTile(params) as WorkerTileWithData;

        expect(res.rawTileData).toBeDefined();
        expect(parseWorkerTileMock).toHaveBeenCalledTimes(3);
        await expect(loadPromise).resolves.toBeTruthy();
    });

    test('VectorTileWorkerSource slices an overzoomed tile from the source maxzoom tile and encodes it as MVT', async () => {
        const rawTileData = readTileFixture('../../integration/assets/tiles/mlt/5/17/10.mlt');
        server.respondWith('http://localhost:2900/5/17/10.mlt', request => {
            request.respond(200, {'Content-Type': 'application/vnd.maplibre-tile'}, rawTileData as any);
        });
        server.autoRespond = true;
        const layerIndex = new StyleLayerIndex([{
            id: 'boundary',
            source: 'source',
            'source-layer': 'boundary',
            type: 'line'
        }]);
        const source = new VectorTileWorkerSource(actor, layerIndex, []);

        const result = await source.loadTile({
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(7, 0, 7, 69, 41),
            request: {url: 'http://localhost:2900/7/69/41.mlt'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
            encoding: 'mlt',
            overzoomParameters: {
                maxZoomTileID: new CanonicalTileID(5, 17, 10),
                overzoomRequest: {url: 'http://localhost:2900/5/17/10.mlt'}
            }
        } as WorkerTileParameters) as WorkerTileWithData;

        expect(server.requests.map(request => request.url)).toEqual(['http://localhost:2900/5/17/10.mlt']);
        expect(result.encoding).toBe('mvt');
        expect(new VectorTile(new PbfReader(result.rawTileData)).layers.boundary.length).toBeGreaterThan(0);
    });

    test('VectorTileWorkerSource.reloadTile of an overzoomed tile draws a source layer added after it loaded, without a new request', async () => {
        const rawTileData = new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../test/unit/assets/mbsv5-6-18-23.vector.pbf'))).buffer;
        const layerIndex = new StyleLayerIndex([{id: 'borders', type: 'line', source: 'source', 'source-layer': 'admin'}]);
        const source = new VectorTileWorkerSource(actor, layerIndex, []);
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, rawTileData as any);
        });
        const params = {
            source: 'source',
            uid: '1',
            tileID: new OverscaledTileID(7, 0, 7, 36, 46),
            request: {url: 'http://localhost:2900/7/36/46.pbf'},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
            overzoomParameters: {
                maxZoomTileID: new CanonicalTileID(6, 18, 23),
                overzoomRequest: {url: 'http://localhost:2900/6/18/23.pbf'}
            }
        } as any as WorkerTileParameters;

        const loadPromise = source.loadTile(params);
        server.respond();
        const loaded = await loadPromise as WorkerTileWithData;
        layerIndex.update([{id: 'water', type: 'fill', source: 'source', 'source-layer': 'water'}], []);
        const reloaded = await source.reloadTile(params) as WorkerTileWithData;

        expect(server.requests).toHaveLength(1);
        expect(reloaded.buckets.some(bucket => bucket.layerIds.includes('water'))).toBe(true);
        expect(new VectorTile(new PbfReader(loaded.rawTileData)).layers.water).toBeDefined();
    });

    test('VectorTileWorkerSource.reloadTile does not parse a tile whose load failed', async () => {
        server.respondWith([404, {}, '']);
        server.autoRespond = true;
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);
        const params = {
            source: 'source',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as WorkerTileParameters;
        await expect(source.loadTile(params)).rejects.toThrow(expect.objectContaining({status: 404}));

        await expect(source.reloadTile(params)).resolves.toBeUndefined();
    });

    test('VectorTileWorkerSource.returns a good error message when failing to parse a tile', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, 'something...');
        });

        const loadTilePromise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters);

        server.respond();

        await expect(loadTilePromise).rejects.toThrow(/Unable to parse the tile at/);
    });

    test('VectorTileWorkerSource.returns a good error message when failing to parse a gzipped tile', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        server.respondWith(new Uint8Array([0x1f, 0x8b]).buffer);

        const loadTilePromise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters);

        server.respond();

        await expect(loadTilePromise).rejects.toThrow(/gzipped/);
    });

    test('VectorTileWorkerSource provides resource timing information', async () => {
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
            name: 'http://localhost:2900/faketile.pbf',
            nextHopProtocol: 'http/1.1',
            redirectEnd: 0,
            redirectStart: 0,
            requestStart: 477,
            responseEnd: 815,
            responseStart: 672,
            secureConnectionStart: 0
        };

        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);

        window.performance.getEntriesByName = vi.fn().mockReturnValue([exampleResourceTiming]);

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, new ArrayBuffer(0) as any);
        });

        const promise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
        } as any as WorkerTileParameters);

        await sleep(0);
        server.respond();
        const res = await promise;

        expect(res.resourceTiming[0]).toEqual(exampleResourceTiming);
    });

    test('VectorTileWorkerSource provides resource timing information (fallback method)', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);

        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = vi.fn().mockImplementation(name => (measures[name] || []));
        window.performance.mark = vi.fn().mockImplementation(name => {
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

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, new ArrayBuffer(0) as any);
        });

        const promise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
        } as any as WorkerTileParameters);

        await sleep(0);
        server.respond();
        const res = await promise;

        expect(res.resourceTiming[0]).toEqual(
            {'duration': 250, 'entryType': 'measure', 'name': 'http://localhost:2900/faketile.pbf', 'startTime': 100}
        );
    });

    test('VectorTileWorkerSource.loadTile parses a tile with an unchanged e-tag that this worker has not loaded', async () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex([]), []);

        const rawTileData = new ArrayBuffer(0);
        server.respondWith(request => {
            request.respond(200, {
                'Content-Type': 'application/pbf',
                'ETag': '"v1"'
            }, rawTileData as any);
        });

        const promise = source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'},
            etag: '"v1"',
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision,
        } as any as WorkerTileParameters);

        server.respond();
        const res = await promise;

        expect(res).toBeDefined();
        expect(res.etagUnmodified).toBeUndefined();
    });
});
