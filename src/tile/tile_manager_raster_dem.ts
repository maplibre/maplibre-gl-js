import {type Tile} from './tile';
import {type InViewTiles} from './tile_manager_in_view_tiles';

/**
 * For raster terrain source, backfill DEM to eliminate visible tile boundaries
 */
export function backfillDEM(tile: Tile, inViewTiles: InViewTiles) {
    const renderables = inViewTiles.getRenderableIds();
    for (const borderId of renderables) {
        if (!tile.neighboringTiles || !tile.neighboringTiles[borderId]) {
            continue;
        }
        const borderTile = inViewTiles.getTileById(borderId);
        if (!tile.neighboringTiles[borderId].backfilled) {
            fillBorder(tile, borderTile);
        }
        if (borderTile.neighboringTiles?.[tile.tileID.key]?.backfilled) {
            continue;
        }
        fillBorder(borderTile, tile);
    }
}

function fillBorder(tile: Tile, borderTile: Tile) {
    tile.needsHillshadePrepare = true;
    tile.needsTerrainPrepare = true;
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

