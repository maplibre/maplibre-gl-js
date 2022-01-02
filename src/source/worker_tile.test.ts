import '../../stub_loader';
import WorkerTile from '../source/worker_tile';
import Wrapper from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import StyleLayerIndex from '../style/style_layer_index';

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1
    });
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]);
}

describe('WorkerTile#parse', done => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        type: 'circle'
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets[0]).toBeTruthy();
        done();
    });
});

describe('WorkerTile#parse skips hidden layers', done => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: {visibility: 'none'}
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets).toHaveLength(0);
        done();
    });
});

describe('WorkerTile#parse skips layers without a corresponding source layer', done => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
    }]);

    const tile = createWorkerTile();
    tile.parse({layers: {}}, layerIndex, [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets).toHaveLength(0);
        done();
    });
});

describe('WorkerTile#parse warns once when encountering a v1 vector tile layer', done => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const data = {
        layers: {
            test: {
                version: 1
            }
        }
    };

    t.stub(console, 'warn');

    const tile = createWorkerTile();
    tile.parse(data, layerIndex, [], {}, (err) => {
        expect(err).toBeFalsy();
        expect(console.warn.calledWithMatch(/does not use vector tile spec v2/)).toBeTruthy();
        done();
    });
});
