import {describe, test, expect} from 'vitest';
import {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source';
import {DEMData} from '../data/dem_data';
import {type WorkerDEMTileParameters} from './worker_source';

describe('loadTile', () => {
    test('loads DEM tile', async () => {
        const source = new RasterDEMTileWorkerSource();

        const data = await source.loadTile({
            source: 'source',
            uid: '0',
            rawImageData: {data: new Uint8ClampedArray(256), height: 8, width: 8},
            dim: 256
        } as any as WorkerDEMTileParameters);
        expect(Object.keys(source.loaded)).toEqual(['0']);
        expect(data instanceof DEMData).toBeTruthy();
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
            uid: '0',
            type: 'raster-dem',
        });

        expect(source.loaded).toEqual({});
    });
});
