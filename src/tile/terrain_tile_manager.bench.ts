import {bench, describe} from 'vitest';
import {TerrainTileManager} from './terrain_tile_manager.ts';
import {OverscaledTileID} from './tile_id.ts';
import {Tile} from './tile.ts';
import type {TileManager} from './tile_manager.ts';

/**
 * Builds a manager holding `count` renderable terrain tiles that are siblings at one zoom, so for any
 * one of them used as the queried tile exactly one entry is kept and the rest hit the `continue`.
 * That is the shape measured on a live map: the kept count tracks the call count almost exactly.
 */
function makeManager(count: number): {manager: TerrainTileManager; visible: OverscaledTileID[]} {
    const manager = new TerrainTileManager({
        _source: {tileSize: 512},
        usedForTerrain: false,
        tileSize: null,
    } as any as TileManager);

    const visible: OverscaledTileID[] = [];
    manager._tiles = {};
    manager._renderableTilesKeys = [];
    for (let i = 0; i < count; i++) {
        const tileID = new OverscaledTileID(8, 0, 8, 40 + i, 90);
        manager._tiles[tileID.key] = new Tile(tileID, 256);
        manager._renderableTilesKeys.push(tileID.key);
        visible.push(tileID);
    }
    return {manager, visible};
}

/**
 * Consumed so neither arm can be optimised away for having an unused result, and checked once so a
 * variant that returned nothing could not read as "fast".
 *
 * Each sweep is one frame's worth of calls for a single draped source, which is the whole cost model:
 * `_renderableTilesKeys` belongs to the one TerrainTileManager and is rebuilt per frame rather than
 * per source, so additional draped sources lengthen the caller's outer loop without changing `count`
 * or the per-call cost.
 */
let sink = 0;

function makeSweep(count: number): () => void {
    const {manager, visible} = makeManager(count);

    const kept = Object.keys(manager._getTerrainCoordsForRegularTile(visible[0])).length;
    if (kept !== 1) {
        throw new Error(`fixture is wrong: expected exactly 1 kept coord per call, got ${kept}`);
    }

    return () => {
        for (const tileID of visible) {
            sink += Object.keys(manager._getTerrainCoordsForRegularTile(tileID)).length;
        }
    };
}

describe('TerrainTileManager#_getTerrainCoordsForRegularTile', () => {
    // 15 and 27 are the renderable-tiles-per-call figures measured on a live globe with terrain at
    // pitch 0 and pitch 60.
    const sweep15 = makeSweep(15);
    const sweep27 = makeSweep(27);
    const sweep64 = makeSweep(64);

    bench('15 renderable tiles', sweep15);
    bench('27 renderable tiles', sweep27);
    bench('64 renderable tiles', sweep64);
});

export {sink};
