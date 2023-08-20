import {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source';
import {DEMData} from '../data/dem_data';
import {WorkerDEMTileParameters} from './worker_source';

describe('loadTile', () => {
    test('loads DEM tile', done => {
        const source = new RasterDEMTileWorkerSource();

        source.loadTile({
            source: 'source',
            uid: '0',
            rawImageData: {data: new Uint8ClampedArray(256), height: 8, width: 8},
            dim: 256
        } as any as WorkerDEMTileParameters, (err, data) => {
            if (err) done(err);
            expect(Object.keys(source.loaded)).toEqual(['0']);
            expect(data instanceof DEMData).toBeTruthy();
            done();
        });
    });
});

describe('removeTile', () => {
    test('removes loaded tile', () => {
        const source = new RasterDEMTileWorkerSource();

        source.loaded = {
            '0': {} as DEMData
        };

        source.removeTile({
            source: 'source',
            uid: '0'
        });

        expect(source.loaded).toEqual({});
    });
});
