import {OverscaledTileID} from './tile_id.ts';

import type {Tile} from './tile.ts';
import type {InViewTiles} from './tile_manager_in_view_tiles.ts';

/**
 * The tiles around a raster terrain tile, whose borders get backfilled into it
 */
export function getNeighboringTiles(tileID: OverscaledTileID): Record<string, {backfilled: boolean}> {
    const canonical = tileID.canonical;
    const dim = Math.pow(2, canonical.z);

    const px = (canonical.x - 1 + dim) % dim;
    const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
    const nx = (canonical.x + 1 + dim) % dim;
    const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

    const neighboringTiles: Record<string, {backfilled: boolean}> = {};
    // add adjacent tiles
    neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = {backfilled: false};
    neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = {backfilled: false};

    // Add upper neighboringTiles
    if (canonical.y > 0) {
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = {backfilled: false};
    }
    // Add lower neighboringTiles
    if (canonical.y + 1 < dim) {
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = {backfilled: false};
    }

    return neighboringTiles;
}

/**
 * For raster terrain source, backfill DEM to eliminate visible tile boundaries
 */
export function backfillDEM(tile: Tile, inViewTiles: InViewTiles): void {
    const renderables = inViewTiles.getRenderableIds();
    for (const borderId of renderables) {
        if (!tile.neighboringTiles?.[borderId]) {
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

