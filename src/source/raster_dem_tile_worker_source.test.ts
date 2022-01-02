import '../../stub_loader';
import {test} from '../../util/test';
import RasterDEMTileWorkerSource from '../../../rollup/build/tsc/src/source/raster_dem_tile_worker_source';
import StyleLayerIndex from '../../../rollup/build/tsc/src/style/style_layer_index';
import DEMData from '../../../rollup/build/tsc/src/data/dem_data';

test('loadTile', (t) => {
    t.test('loads DEM tile', (t) => {
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

            t.end();
        });
    });

    t.end();
});

test('removeTile', (t) => {
    t.test('removes loaded tile', (t) => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loaded = {
            '0': {}
        };

        source.removeTile({
            source: 'source',
            uid: 0
        });

        expect(source.loaded).toEqual({});
        t.end();
    });

    t.end();
});
