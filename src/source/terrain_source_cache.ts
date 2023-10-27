import {OverscaledTileID} from './tile_id';
import {Tile} from './tile';
import {EXTENT} from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import type {Transform} from '../geo/transform';
import type {SourceCache} from '../source/source_cache';
import {Terrain} from '../render/terrain';

/**
 * @internal
 * This class is a helper for the Terrain-class, it:
 *   - loads raster-dem tiles
 *   - manages all renderToTexture tiles.
 *   - caches previous rendered tiles.
 *   - finds all necessary renderToTexture tiles for a OverscaledTileID area
 *   - finds the corresponding raster-dem tile for OverscaledTileID
 */
export class TerrainSourceCache extends Evented {
    /**
     * source-cache for the raster-dem source.
     */
    sourceCache: SourceCache;
    /**
     * contains a map of tileID-key to tileID for the current scene. (only for performance)
     */
    _renderableTiles: {[_: string]: OverscaledTileID};
    /**
     * raster-dem-tile for a TileID cache.
     */
    _sourceTileCache: {[_: string]: string};
    /**
     * render-to-texture tileSize in scene.
     */
    tileSize: number;
    /**
     * raster-dem tiles will load for performance the actualZoom - deltaZoom zoom-level.
     */
    deltaZoom: number;
    /**
     * used to determine whether depth & coord framebuffers need updating
     */
    _lastTilesetChange: number = Date.now();

    constructor(sourceCache: SourceCache) {
        super();
        this.sourceCache = sourceCache;
        this._renderableTiles = {};
        this._sourceTileCache = {};
        this.tileSize = 512;
        this.deltaZoom = 1;
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize * 2 ** this.deltaZoom;
    }

    destruct() {
        this.sourceCache.usedForTerrain = false;
        this.sourceCache.tileSize = null;
    }

    /**
     * Load Terrain Tiles, create internal render-to-texture tiles, free GPU memory.
     * @param transform - the operation to do
     * @param terrain - the terrain
     * @param coveringTiles - visible tiles, obtained from `transform.coveringTiles()`
     */
    update(transform: Transform, terrain: Terrain, coveringTiles: Array<OverscaledTileID>): void {
        // load raster-dem tiles for the current scene.
        this.sourceCache.update(transform, terrain);
        // create internal render-to-texture tiles for the current scene.
        this._renderableTiles = {};
        for (const tileID of coveringTiles) {
            this._renderableTiles[tileID.key] = tileID;
            tileID.posMatrix = new Float64Array(16) as any;
            mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
            this._lastTilesetChange = Date.now();
        }
    }

    /**
     * get terrain tile by the TileID key
     * @param id - the tile id
     * @returns the tile
     */
    getTileIDByKey(id: string): OverscaledTileID {
        return this._renderableTiles[id];
    }

    /**
     * find the covering raster-dem tile
     * @param tileID - the tile to look for
     * @param searchForDEM - Optinal parameter to search for (parent) souretiles with loaded dem.
     * @returns the tile
     */
    getSourceTile(tileID: OverscaledTileID, searchForDEM?: boolean): Tile {
        const source = this.sourceCache._source;
        let z = tileID.overscaledZ - this.deltaZoom;
        if (z > source.maxzoom) z = source.maxzoom;
        if (z < source.minzoom) return null;
        // cache for tileID to terrain-tileID
        if (!this._sourceTileCache[tileID.key])
            this._sourceTileCache[tileID.key] = tileID.scaledTo(z).key;
        let tile = this.sourceCache.getTileByID(this._sourceTileCache[tileID.key]);
        // during tile-loading phase look if parent tiles (with loaded dem) are available.
        if (!(tile && tile.dem) && searchForDEM)
            while (z >= source.minzoom && !(tile && tile.dem))
                tile = this.sourceCache.getTileByID(tileID.scaledTo(z--).key);
        return tile;
    }

    /**
     * gets whether any tiles were loaded after a specific time. This is used to update depth & coords framebuffers.
     * @param time - the time
     * @returns true if any tiles came into view at or after the specified time
     */
    anyTilesAfterTime(time = Date.now()): boolean {
        return this._lastTilesetChange >= time;
    }
}
