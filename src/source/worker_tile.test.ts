import WorkerTile from '../source/worker_tile';
import Wrapper, {Feature} from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import StyleLayerIndex from '../style/style_layer_index';
import {WorkerTileParameters} from './worker_source';
import Actor from '../util/actor';
import {VectorTile} from '@mapbox/vector-tile';

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1
    } as any as WorkerTileParameters);
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    } as any as Feature]);
}

describe('worker tile', () => {
    test('WorkerTile#parse', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            type: 'circle'
        }]);

        const tile = createWorkerTile();
        tile.parse(createWrapper(), layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets[0]).toBeTruthy();
            done();
        });
    });

    test('WorkerTile#parse skips hidden layers', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: {visibility: 'none'}
        }]);

        const tile = createWorkerTile();
        tile.parse(createWrapper(), layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets).toHaveLength(0);
            done();
        });
    });

    test('WorkerTile#parse skips layers without a corresponding source layer', done => {
        const layerIndex = new StyleLayerIndex([{
            id: 'test',
            source: 'source',
            'source-layer': 'nonesuch',
            type: 'fill'
        }]);

        const tile = createWorkerTile();
        tile.parse({layers: {}}, layerIndex, [], {} as Actor, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.buckets).toHaveLength(0);
            done();
        });
    });

    test('WorkerTile#parse warns once when encountering a v1 vector tile layer', done => {
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
        } as any as VectorTile;

        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const tile = createWorkerTile();
        tile.parse(data, layerIndex, [], {} as Actor, (err) => {
            expect(err).toBeFalsy();
            expect(spy.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
            done();
        });
    });
});
