import type {Tile} from './tile.ts';
import type {InViewTiles} from './tile_manager_in_view_tiles.ts';

/**
 * For raster terrain source, backfill DEM to eliminate visible tile boundaries.
 *
 * Called when `tile` has new DEM data (a load or reload) or comes back into view from the out-of-view cache, so the
 * borders are filled both ways every time: a `backfilled` mark says a border was filled once, not that it holds the
 * neighbour's current data. Skipping on it left a reloaded tile's neighbours with its old edge, and a tile whose
 * neighbour landed while it was reloading with the old data's border.
 */
export function backfillDEM(tile: Tile, inViewTiles: InViewTiles): void {
    const renderables = inViewTiles.getRenderableIds();
    for (const borderId of renderables) {
        if (!tile.neighboringTiles?.[borderId]) {
            continue;
        }
        const borderTile = inViewTiles.getTileById(borderId);
        fillBorder(tile, borderTile);
        fillBorder(borderTile, tile);
    }
}

function fillBorder(tile: Tile, borderTile: Tile) {
    tile.needsHillshadePrepare = true;
    tile.needsTerrainPrepare = true;
    tile.needsColorReliefPrepare = true;
    let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
    const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
    const dim = Math.pow(2, tile.tileID.canonical.z);
    const borderId = borderTile.tileID.key;
    if (dx === 0 && dy === 0) return;

    if (Math.abs(dy) > 1) {
        return;
    }
    if (Math.abs(dx) > 1) {
        // Adjust the delta coordinate for world wraparound.
        if (Math.abs(dx + dim) === 1) {
            dx += dim;
        } else if (Math.abs(dx - dim) === 1) {
            dx -= dim;
        }
    }
    if (!borderTile.dem || !tile.dem) return;
    tile.dem.backfillBorder(borderTile.dem, dx, dy);
    if (tile.neighboringTiles?.[borderId]) {
        tile.neighboringTiles[borderId].backfilled = true;
    }
}

