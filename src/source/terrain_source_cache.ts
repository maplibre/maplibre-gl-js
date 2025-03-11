import {type OverscaledTileID} from './tile_id';
import {Tile} from './tile';
import {EXTENT} from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import type {ITransform} from '../geo/transform_interface';
import type {SourceCache} from '../source/source_cache';
import {type Terrain} from '../render/terrain';
import {browser} from '../util/browser';
import {coveringTiles} from '../geo/projection/covering_tiles';
import {createMat4f64} from '../util/util';

/**
 * @internal
 * This class is a helper for the Terrain-class, it:
 *
 * - loads raster-dem tiles
 * - manages all renderToTexture tiles.
 * - caches previous rendered tiles.
 * - finds all necessary renderToTexture tiles for a OverscaledTileID area
 * - finds the corresponding raster-dem tile for OverscaledTileID
 */
export class TerrainSourceCache extends Evented {
    /**
     * source-cache for the raster-dem source.
     */
    sourceCache: SourceCache;
    /**
     * stores all render-to-texture tiles.
     */
    _tiles: {[_: string]: Tile};
    /**
     * contains a list of tileID-keys for the current scene. (only for performance)
     */
    _renderableTilesKeys: Array<string>;
    /**
     * raster-dem-tile for a TileID cache.
     */
    _sourceTileCache: {[_: string]: string};
    /**
     * minimum zoomlevel to render the terrain.
     */
    minzoom: number;
    /**
     * maximum zoomlevel to render the terrain.
     */
    maxzoom: number;
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
    _lastTilesetChange: number = browser.now();

    constructor(sourceCache: SourceCache) {
        super();
        this.sourceCache = sourceCache;
        this._tiles = {};
        this._renderableTilesKeys = [];
        this._sourceTileCache = {};
        this.minzoom = 0;
        this.maxzoom = 22;
        this.deltaZoom = 1;
        this.tileSize = sourceCache._source.tileSize * 2 ** this.deltaZoom;
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize;
    }

    destruct() {
        this.sourceCache.usedForTerrain = false;
        this.sourceCache.tileSize = null;
    }

    /**
     * Load Terrain Tiles, create internal render-to-texture tiles, free GPU memory.
     * @param transform - the operation to do
     * @param terrain - the terrain
     */
    update(transform: ITransform, terrain: Terrain): void {
        // load raster-dem tiles for the current scene.
        this.sourceCache.update(transform, terrain);
        // create internal render-to-texture tiles for the current scene.
        this._renderableTilesKeys = [];
        const keys = {};
        for (const tileID of coveringTiles(transform, {
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false,
            terrain,
            calculateTileZoom: this.sourceCache._source.calculateTileZoom
        })) {
            keys[tileID.key] = true;
            this._renderableTilesKeys.push(tileID.key);
            if (!this._tiles[tileID.key]) {
                tileID.terrainRttPosMatrix32f = new Float64Array(16) as any;
                mat4.ortho(tileID.terrainRttPosMatrix32f, 0, EXTENT, EXTENT, 0, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
                this._lastTilesetChange = browser.now();
            }
        }
        // free unused tiles
        for (const key in this._tiles) {
            if (!keys[key]) delete this._tiles[key];
        }
    }

    /**
     * Free render to texture cache
     * @param tileID - optional, free only corresponding to tileID.
     */
    freeRtt(tileID?: OverscaledTileID) {
        for (const key in this._tiles) {
            const tile = this._tiles[key];
            if (!tileID || tile.tileID.equals(tileID) || tile.tileID.isChildOf(tileID) || tileID.isChildOf(tile.tileID))
                tile.rtt = [];
        }
    }

    /**
     * get a list of tiles, which are loaded and should be rendered in the current scene
     * @returns the renderable tiles
     */
    getRenderableTiles(): Array<Tile> {
        return this._renderableTilesKeys.map(key => this.getTileByID(key));
    }

    /**
     * get terrain tile by the TileID key
     * @param id - the tile id
     * @returns the tile
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * Searches for the corresponding current renderable terrain-tiles
     * @param tileID - the tile to look for
     * @returns the tiles that were found
     */
    getTerrainCoords(tileID: OverscaledTileID): Record<string, OverscaledTileID> {
        const coords = {};
        for (const key of this._renderableTilesKeys) {
            const _tileID = this._tiles[key].tileID;
            const coord = tileID.clone();
            const mat = createMat4f64();
            if (_tileID.canonical.equals(tileID.canonical)) {
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
            } else if (_tileID.canonical.isChildOf(tileID.canonical)) {
                const dz = _tileID.canonical.z - tileID.canonical.z;
                const dx = _tileID.canonical.x - (_tileID.canonical.x >> dz << dz);
                const dy = _tileID.canonical.y - (_tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1); // Note: we are using `size` instead of `EXTENT` here
                mat4.translate(mat, mat, [-dx * size, -dy * size, 0]);
            } else if (tileID.canonical.isChildOf(_tileID.canonical)) {
                const dz = tileID.canonical.z - _tileID.canonical.z;
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
                mat4.translate(mat, mat, [dx * size, dy * size, 0]);
                mat4.scale(mat, mat, [1 / (2 ** dz), 1 / (2 ** dz), 0]);
            } else {
                continue;
            }
            coord.terrainRttPosMatrix32f = new Float32Array(mat);
            coords[key] = coord;
        }
        return coords;
    }

    /**
     * find the covering raster-dem tile
     * @param tileID - the tile to look for
     * @param searchForDEM - Optional parameter to search for (parent) source tiles with loaded dem.
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
