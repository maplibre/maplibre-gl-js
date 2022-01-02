import '../../stub_loader';
import RasterDEMTileWorkerSource from '../source/raster_dem_tile_worker_source';
import StyleLayerIndex from '../style/style_layer_index';
import DEMData from '../data/dem_data';

describe('loadTile', done => {
    test('loads DEM tile', done => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loadTile({
            source: 'source',
            uid: 0,
            rawImageData: {data: new Uint8ClampedArray(256), height: 8, width: 8},
            dim: 256
        }, (err, data) => {
            if (err) t.fail();
            expect(Object.keys(source.loaded)).toEqual([0]);
            expect(data instanceof DEMData).toBeTruthy();

            done();
        });
    });

    done();
});

describe('removeTile', done => {
    test('removes loaded tile', done => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loaded = {
            '0': {}
        };

        source.removeTile({
            source: 'source',
            uid: 0
        });

        expect(source.loaded).toEqual({});
        done();
    });

    done();
});
