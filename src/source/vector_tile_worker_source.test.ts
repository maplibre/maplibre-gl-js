import fs from 'fs';
import path from 'path';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {VectorTileWorkerSource} from '../source/vector_tile_worker_source';
import {StyleLayerIndex} from '../style/style_layer_index';
import {fakeServer, type FakeServer} from 'nise';
import {Actor} from '../util/actor';
import {TileParameters, WorkerTileParameters, WorkerTileResult} from './worker_source';
import {WorkerTile} from './worker_tile';
import {setPerformance} from '../util/test/util';

describe('vector tile worker source', () => {
    const actor = {send: () => {}} as any as Actor;
    let server: FakeServer;

    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        setPerformance();
    });

    afterEach(() => {
        server.restore();
        jest.clearAllMocks();
    });
    test('VectorTileWorkerSource#abortTile aborts pending request', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/abort'}
        } as any as WorkerTileParameters).then((res) => {
            expect(res).toBeFalsy();
        }).catch((err) => expect(err).toBeUndefined());

        source.abortTile({
            source: 'source',
            uid: 0
        } as any as TileParameters).then((res) => {
            expect(res).toBeFalsy();
        }).catch(() => expect(false).toBeTruthy());

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
        } as any as TileParameters).then((res) => {
            expect(res).toBeFalsy();
        }).catch(() => expect(false).toBeTruthy());

        expect(source.loaded).toEqual({});
    });

    test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', () => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn().mockReturnValue(Promise.resolve({} as WorkerTileResult));

        source.loaded = {
            '0': {
                status: 'done',
                vectorTile: {},
                parse
            } as any as WorkerTile
        };

        source.reloadTile({uid: 0} as any as WorkerTileParameters).then(() => expect(true).toBeTruthy());
        expect(parse).toHaveBeenCalledTimes(1);
    });

    test('VectorTileWorkerSource#loadTile reparses tile if the reloadTile has been called during parsing', (done) => {
        const rawTileData = new Uint8Array([]);
        function loadVectorData(params, callback) {
            return callback(null, {
                vectorTile: {
                    layers: {
                        test: {
                            version: 2,
                            name: 'test',
                            extent: 8192,
                            length: 1,
                            feature: (featureIndex: number) => ({
                                extent: 8192,
                                type: 1,
                                id: featureIndex,
                                properties: {
                                    name: 'test'
                                },
                                loadGeometry () {
                                    return [[{x: 0, y: 0}]];
                                }
                            })
                        }
                    }
                } as any as vt.VectorTile,
                rawData: rawTileData
            });
        }

        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'symbol',
            layout: {
                'icon-image': 'hello',
                'text-font': ['StandardFont-Bold'],
                'text-field': '{name}'
            }
        }]);

        const send = jest.fn().mockImplementation((type: string, data: unknown, callback: Function) => {
            const res = setTimeout(() => callback(null,
                type === 'getImages' ?
                    {'hello': {width: 1, height: 1, data: new Uint8Array([0])}} :
                    {'StandardFont-Bold': {width: 1, height: 1, data: new Uint8Array([0])}}
            ));

            return {
                cancel: () => clearTimeout(res)
            };
        });

        const actor = {
            send
        } as unknown as Actor;
        const source = new VectorTileWorkerSource(actor, layerIndex, ['hello'], loadVectorData);
        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters).then(() => {
            done.fail('should not be called');
        });

        source.reloadTile({
            source: 'source',
            uid: '0',
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        } as any as WorkerTileParameters).then((res) => {
            expect(res).toBeDefined();
            expect(res.rawTileData).toBeDefined();
            expect(res.rawTileData).toStrictEqual(rawTileData);
            done();
        }).catch(() => { done.fail('should not be called'); });
    });

    test('VectorTileWorkerSource#loadTile reparses tile if reloadTile is called during reparsing', (done) => {
        const rawTileData = new Uint8Array([]);
        function loadVectorData(params, callback) {
            return callback(null, {
                vectorTile: new vt.VectorTile(new Protobuf(rawTileData)),
                rawData: rawTileData
            });
        }

        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'fill'
        }]);

        const source = new VectorTileWorkerSource(actor, layerIndex, [], loadVectorData);

        const parseWorkerTileMock = jest
            .spyOn(WorkerTile.prototype, 'parse')
            .mockImplementation(function(_data, _layerIndex, _availableImages, _actor) {
                this.status = 'parsing';
                return new Promise((resolve) => {
                    setTimeout(() => resolve({} as WorkerTileResult), 10);
                });
            });

        let loadCallbackCalled = false;
        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters).then((res) => {
            expect(res).toBeDefined();
            loadCallbackCalled = true;
        }).catch(() => expect(false).toBeTruthy());

        source.reloadTile({
            source: 'source',
            uid: '0',
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        } as any as WorkerTileParameters).then((res) => {
            expect(res).toBeDefined();
            expect(parseWorkerTileMock).toHaveBeenCalledTimes(2);
            expect(loadCallbackCalled).toBeTruthy();
            done();
        }).catch(() => expect(false).toBeTruthy());
    });

    test('VectorTileWorkerSource#reloadTile does not reparse tiles with no vectorTile data but does call callback', done => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        source.loaded = {
            '0': {
                status: 'done',
                parse
            } as any as WorkerTile
        };

        source.reloadTile({uid: 0} as any as WorkerTileParameters).then(() => {
            expect(true).toBeTruthy();
            done();
        });
        expect(parse).not.toHaveBeenCalled();
    });

    test('VectorTileWorkerSource#returns a good error message when failing to parse a tile', done => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/pbf'}, 'something...');
        });

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters).catch((err) => {
            expect(err.message).toContain('Unable to parse the tile at');
            done();
        });

        server.respond();

        expect(parse).not.toHaveBeenCalled();
    });

    test('VectorTileWorkerSource#returns a good error message when failing to parse a gzipped tile', done => {
        const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
        const parse = jest.fn();

        server.respondWith(new Uint8Array([0x1f, 0x8b]).buffer);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf'}
        } as any as WorkerTileParameters).catch((err) => {
            expect(err.message).toContain('gzipped');
            done();
        });

        server.respond();

        expect(parse).not.toHaveBeenCalled();
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

        window.performance.getEntriesByName = jest.fn().mockReturnValue([exampleResourceTiming]);

        source.loadTile({
            source: 'source',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
        } as any as WorkerTileParameters).then((res) => {
            expect(res.resourceTiming[0]).toEqual(exampleResourceTiming);
            done();
        }).catch(() => expect(false).toBeTruthy());
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
        } as any as WorkerTileParameters).then((res) => {
            expect(res.resourceTiming[0]).toEqual(
                {'duration': 250, 'entryType': 'measure', 'name': 'http://localhost:2900/faketile.pbf', 'startTime': 100}
            );
            done();
        }).catch(() => expect(false).toBeTruthy());
    });
});
