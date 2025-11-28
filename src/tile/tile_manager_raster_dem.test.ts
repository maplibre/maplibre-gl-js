import {describe, test, expect, vi} from 'vitest';
import {backfillDEM} from './tile_manager_raster_dem';
import {Tile} from './tile';
import {OverscaledTileID} from './tile_id';
import {InViewTiles} from './tile_manager_in_view_tiles';
import type {DEMData} from '../data/dem_data';

describe('backfillDEM', () => {

    test('do not backfill when no neighboring tiles information exists', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        tile.state = 'loaded';
        tile.dem = {
            backfillBorder: vi.fn()
        } as any as DEMData;

        backfillDEM(tile, new InViewTiles());

        expect(tile.dem.backfillBorder).toHaveBeenCalledTimes(0);
    });

    test('backfill when needed', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        tile.state = 'loaded';
        tile.dem = {
            backfillBorder: vi.fn()
        } as any as DEMData;
        
        const neighbor = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), 512);
        neighbor.state = 'loaded';
        neighbor.dem = {
            backfillBorder: vi.fn()
        } as any as DEMData;

        // Setup neighboringTiles
        tile.neighboringTiles = {
            [neighbor.tileID.key]: {backfilled: false}
        };
        neighbor.neighboringTiles = {
            [tile.tileID.key]: {backfilled: false}
        };

        const inViewTiles = new InViewTiles();
        inViewTiles.setTile(tile.tileID.key, tile);
        inViewTiles.setTile(neighbor.tileID.key, neighbor);

        backfillDEM(tile, inViewTiles);

        expect(tile.dem.backfillBorder).toHaveBeenCalledTimes(1);
        expect(neighbor.dem.backfillBorder).toHaveBeenCalledTimes(1);
    });

    test('avoids redundant backfilling', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        tile.state = 'loaded';
        tile.dem = {
            backfillBorder: vi.fn()
        } as any as DEMData;
        
        const neighbor = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), 512);
        neighbor.state = 'loaded';
        neighbor.dem = {
            backfillBorder: vi.fn()
        } as any as DEMData;

        // Setup neighboringTiles
        tile.neighboringTiles = {
            [neighbor.tileID.key]: {backfilled: false}
        };
        neighbor.neighboringTiles = {
            [tile.tileID.key]: {backfilled: false}
        };

        const inViewTiles = new InViewTiles();
        inViewTiles.setTile(tile.tileID.key, tile);
        inViewTiles.setTile(neighbor.tileID.key, neighbor);

        backfillDEM(tile, inViewTiles);
        backfillDEM(neighbor, inViewTiles);

        expect(tile.dem.backfillBorder).toHaveBeenCalledTimes(1);
        expect(neighbor.dem.backfillBorder).toHaveBeenCalledTimes(1);
        expect(tile.neighboringTiles[neighbor.tileID.key].backfilled).toBe(true);
    });
});
