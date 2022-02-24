import fs from 'fs';
import path from 'path';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import VectorTileWorkerSource from '../source/vector_tile_worker_source';
import StyleLayerIndex from '../style/style_layer_index';
import {fakeServer, FakeServer} from 'nise';
import Actor from '../util/actor';
import {TileParameters, WorkerTileParameters} from './worker_source';
import WorkerTile from './worker_tile';
import {setPerformance} from '../util/test/util';

describe('vector tile worker source', () => {
    const actor = {send: () => {}} as any as Actor;
    let server: FakeServer;
    let originalGetEntriesByName;
    let originalMeasure;
    let originalMark;

    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        setPerformance();
        originalGetEntriesByName = window.performance.getEntriesByName;
        originalMeasure = window.performance.measure;
        originalMark = window.performance.mark;

    });

    afterEach(() => {
        server.restore();
        jest.clearAllMocks();
        window.performance.getEntriesByName = originalGetEntriesByName;
        window.performance.measure = originalMeasure;
        window.performance.mark = originalMark;
    });
    test('VectorTileWorkerSource#abortTile aborts pending request', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/abort'}
        } as any as WorkerTileParameters, (err, res) => {
            expect(err).toBeFalsy();
            expect(res).toBeFalsy();
        });

        source.abortTile({
            source: 'source',
            uid: 0
        } as any as TileParameters, (err, res) => {
            expect(err).toBeFalsy();
            expect(res).toBeFalsy();
        });

        expect(source.loading).toEqual({});
    });

    test('VectorTileWorkerSource#removeTile removes loaded tile', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        source.loaded = {
            '0': {} as WorkerTile
        };

        source.removeTile({
            source: 'source',
            uid: 0
        } as any as TileParameters, (err, res) => {
            expect(err).toBeFalsy();
            expect(res).toBeFalsy();
        });

        expect(source.loaded).toEqual({});
    });

    test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        source.loaded = {
            '0': {
                status: 'done',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        const callback = jest.fn();
        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback);
        expect(parse).toHaveBeenCalledTimes(1);

        parse.mock.calls[0][4]();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        source.loaded = {
            '0': {
                status: 'done',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        const callback1 = jest.fn();
        const callback2 = jest.fn();
        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback1);
        expect(parse).toHaveBeenCalledTimes(1);

        source.loaded[0].status = 'parsing';
        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback2);
        expect(parse).toHaveBeenCalledTimes(1);

        parse.mock.calls[0][4]();
        expect(parse).toHaveBeenCalledTimes(2);
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(0);

        parse.mock.calls[1][4]();
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
    });

    test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', () => {
        // https://github.com/mapbox/mapbox-gl-js/issues/6308
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        source.loaded = {
            '0': {
                status: 'done',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const callback3 = jest.fn();
        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback1);
        expect(parse).toHaveBeenCalledTimes(1);

        source.loaded[0].status = 'parsing';
        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback2);
        expect(parse).toHaveBeenCalledTimes(1);

        parse.mock.calls[0][4]();
        expect(parse).toHaveBeenCalledTimes(2);
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(0);
        expect(callback3).toHaveBeenCalledTimes(0);

        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback3);
        expect(parse).toHaveBeenCalledTimes(2);
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(0);
        expect(callback3).toHaveBeenCalledTimes(0);

        parse.mock.calls[1][4]();
        expect(parse).toHaveBeenCalledTimes(3);
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback3).toHaveBeenCalledTimes(0);

        parse.mock.calls[2][4]();
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback3).toHaveBeenCalledTimes(1);

    });

    test('VectorTileWorkerSource#reloadTile does not reparse tiles with no vectorTile data but does call callback', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        source.loaded = {
            '0': {
                status: 'done',
                parse
            } as any as WorkerTile
        };

        const callback = jest.fn();

        source.reloadTile({uid: 0} as any as WorkerTileParameters, callback);
        expect(parse).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalledTimes(1);

    });

    test('VectorTileWorkerSource provides resource timing information', done => {
        const rawTileData = fs.readFileSync(path.join(__dirname, '/../../test/unit/assets/mbsv5-6-18-23.vector.pbf'));

        function loadVectorData(params, callback) {
            return callback(null, {
                vectorTile: new vt.VectorTile(new Protobuf(rawTileData)),
                rawData: rawTileData,
                cacheControl: null,
                expires: null
            });
        }

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

        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'fill'
        }]);

        const source = new VectorTileWorkerSource(actor, layerIndex, [], loadVectorData);

        window.performance.getEntriesByName = jest.fn().mockReturnValue([ exampleResourceTiming ]);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
        } as any as WorkerTileParameters, (err, res) => {
            expect(err).toBeFalsy();
            expect(res.resourceTiming[0]).toEqual(exampleResourceTiming);
            done();
        });
    });

    test('VectorTileWorkerSource provides resource timing information (fallback method)', done => {
        const rawTileData = fs.readFileSync(path.join(__dirname, '/../../test/unit/assets/mbsv5-6-18-23.vector.pbf'));

        function loadVectorData(params, callback) {
            return callback(null, {
                vectorTile: new vt.VectorTile(new Protobuf(rawTileData)),
                rawData: rawTileData,
                cacheControl: null,
                expires: null
            });
        }

        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'fill'
        }]);

        const source = new VectorTileWorkerSource(actor, layerIndex, [], loadVectorData);

        const sampleMarks = [100, 350];
        const marks = {};
        const measures = {};
        window.performance.getEntriesByName = jest.fn().mockImplementation(name => (measures[name] || []));
        window.performance.mark = jest.fn().mockImplementation(name => {
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

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
        } as any as WorkerTileParameters, (err, res) => {
            expect(err).toBeFalsy();
            expect(res.resourceTiming[0]).toEqual(
                {'duration': 250, 'entryType': 'measure', 'name': 'http://localhost:2900/faketile.pbf', 'startTime': 100}
            );
            done();
        });
    });
});
