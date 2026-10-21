import {describe, test, expect, vi} from 'vitest';
import {backfillDEM} from './tile_manager_raster_dem.ts';
import {Tile} from './tile.ts';
import {OverscaledTileID} from './tile_id.ts';
import {InViewTiles} from './tile_manager_in_view_tiles.ts';
import {DEMData} from '../data/dem_data.ts';
import {RGBAImage} from '../util/image.ts';

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

    test('a reloaded tile\'s new data goes to its neighbours', () => {
        const [a, b] = loadedPair(100, 200);
        backfillDEM(a, inView(a, b));
        expect(a.dem.get(4, 0)).toBe(200);

        // b reloaded (refreshTiles, expiry): new data, fresh marks of its own; a's mark for b still set
        b.dem = flatDEM(300);
        b.neighboringTiles = {[a.tileID.key]: {backfilled: false}};
        backfillDEM(b, inView(a, b));

        expect(a.dem.get(4, 0)).toBe(300);
        expect(b.dem.get(-1, 0)).toBe(100);
    });

    test('a neighbour landing while the tile reloads doesn\'t leave the tile\'s new data unfilled', () => {
        const [a, b] = loadedPair(100, 200);
        // a's reload has started (marks reset); b lands meanwhile and fills a's old data
        a.neighboringTiles = {[b.tileID.key]: {backfilled: false}};
        backfillDEM(b, inView(a, b));
        // then a's new data arrives
        a.dem = flatDEM(150);
        backfillDEM(a, inView(a, b));

        expect(a.dem.get(4, 0)).toBe(200);
        expect(b.dem.get(-1, 0)).toBe(150);
    });
});

// A DEM tile 4 pixels a side, all at height v (terrarium), its border (as constructed) its own edge
function flatDEM(v: number): DEMData {
    const size = 4 + 4, pixels = new Uint8Array(size * size * 4), h = v + 32768;
    for (let i = 0; i < size * size; i++) pixels.set([Math.floor(h / 256), h % 256, 0, 255], i * 4);
    return new DEMData(String(v), new RGBAImage({width: size, height: size}, pixels), 'terrarium');
}

function loadedPair(va: number, vb: number): [Tile, Tile] {
    const a = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512), b = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), 512);
    for (const [t, v, other] of [[a, va, b], [b, vb, a]] as const) {
        t.state = 'loaded';
        t.dem = flatDEM(v);
        t.neighboringTiles = {[other.tileID.key]: {backfilled: false}};
    }
    return [a, b];
}

function inView(...tiles: Tile[]): InViewTiles {
    const v = new InViewTiles();
    for (const t of tiles) v.setTile(t.tileID.key, t);
    return v;
}
