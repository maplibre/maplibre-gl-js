import '../../stub_loader';
import fs from 'fs';
import path, {dirname} from 'path';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import VectorTileWorkerSource from '../source/vector_tile_worker_source';
import StyleLayerIndex from '../style/style_layer_index';
import perf from '../util/performance';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const actor = {send: () => {}};
describe('VectorTileWorkerSource#abortTile aborts pending request', done => {
    window.useFakeXMLHttpRequest();
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        request: {url: 'http://localhost:2900/abort'}
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    source.abortTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    expect(source.loading).toEqual({});
    window.clearFakeXMLHttpRequest();
    done();
});

describe('VectorTileWorkerSource#removeTile removes loaded tile', done => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);

    source.loaded = {
        '0': {}
    };

    source.removeTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    expect(source.loaded).toEqual({});
    done();
});

describe('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', done => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
    const parse = jest.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback = jest.fn();
    source.reloadTile({uid: 0}, callback);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.firstCall.args[4]();
    expect(callback).toHaveBeenCalledTimes(1);

    done();
});

describe('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', done => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
    const parse = jest.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback1 = jest.fn();
    const callback2 = jest.fn();
    source.reloadTile({uid: 0}, callback1);
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({uid: 0}, callback2);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.firstCall.args[4]();
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(0);

    parse.secondCall.args[4]();
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    done();
});

describe('VectorTileWorkerSource#reloadTile handles multiple pending reloads', done => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6308
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
    const parse = jest.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    source.reloadTile({uid: 0}, callback1);
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({uid: 0}, callback2);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.firstCall.args[4]();
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(0);
    expect(callback3).toHaveBeenCalledTimes(0);

    source.reloadTile({uid: 0}, callback3);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(0);
    expect(callback3).toHaveBeenCalledTimes(0);

    parse.secondCall.args[4]();
    expect(parse).toHaveBeenCalledTimes(3);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(0);

    parse.thirdCall.args[4]();
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);

    done();
});

describe('VectorTileWorkerSource#reloadTile does not reparse tiles with no vectorTile data but does call callback', done => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), []);
    const parse = jest.fn();

    source.loaded = {
        '0': {
            status: 'done',
            parse
        }
    };

    const callback = jest.fn();

    source.reloadTile({uid: 0}, callback);
    expect(parse).not.toHaveBeenCalled();
    expect(callback.calledOnce).toBeTruthy();

    done();
});

describe('VectorTileWorkerSource provides resource timing information', done => {
    const rawTileData = fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));

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

    t.stub(perf, 'getEntriesByName').callsFake(() => { return [ exampleResourceTiming ]; });

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res.resourceTiming[0]).toEqual(exampleResourceTiming);
        done();
    });
});

describe('VectorTileWorkerSource provides resource timing information (fallback method)', done => {
    const rawTileData = fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));

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
    t.stub(perf, 'getEntriesByName').callsFake((name) => { return measures[name] || []; });
    t.stub(perf, 'mark').callsFake((name) => {
        marks[name] = sampleMarks.shift();
        return null;
    });
    t.stub(perf, 'measure').callsFake((name, start, end) => {
        measures[name] = measures[name] || [];
        measures[name].push({
            duration: marks[end] - marks[start],
            entryType: 'measure',
            name,
            startTime: marks[start]
        });
        return null;
    });
    t.stub(perf, 'clearMarks').callsFake(() => { return null; });
    t.stub(perf, 'clearMeasures').callsFake(() => { return null; });

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res.resourceTiming[0]).toEqual(
            {'duration': 250, 'entryType': 'measure', 'name': 'http://localhost:2900/faketile.pbf', 'startTime': 100}
        );
        done();
    });
});

