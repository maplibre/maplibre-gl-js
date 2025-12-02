import {type OverscaledTileID} from './tile_id';
import {Tile} from './tile';
import {EXTENT} from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import type {ITransform} from '../geo/transform_interface';
import type {TileManager} from './tile_manager';
import type {Source} from '../source/source';
import {type Terrain} from '../render/terrain';
import {now} from '../util/time_control';
import {coveringTiles} from '../geo/projection/covering_tiles';
import {createMat4f64} from '../util/util';
import {type CanonicalTileRange} from '../source/image_source';

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
export class TerrainTileManager extends Evented {
    /**
     * tile manager for the raster-dem source.
     */
    tileManager: TileManager;
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
    _lastTilesetChange: number = now();

    constructor(tileManager: TileManager) {
        super();
        this.tileManager = tileManager;
        this._tiles = {};
        this._renderableTilesKeys = [];
        this._sourceTileCache = {};
        this.minzoom = 0;
        this.maxzoom = 22;
        this.deltaZoom = 1;
        this.tileSize = tileManager._source.tileSize * 2 ** this.deltaZoom;
        tileManager.usedForTerrain = true;
        tileManager.tileSize = this.tileSize;
    }

    destruct() {
        this.tileManager.usedForTerrain = false;
        this.tileManager.tileSize = null;
    }

    getSource(): Source {
        return this.tileManager._source;
    }

    /**
     * Load Terrain Tiles, create internal render-to-texture tiles, free GPU memory.
     * @param transform - the operation to do
     * @param terrain - the terrain
     */
    update(transform: ITransform, terrain: Terrain): void {
        // load raster-dem tiles for the current scene.
        this.tileManager.update(transform, terrain);
        // create internal render-to-texture tiles for the current scene.
        this._renderableTilesKeys = [];
        const keys = {};
        for (const tileID of coveringTiles(transform, {
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false,
            terrain,
            calculateTileZoom: this.tileManager._source.calculateTileZoom
        })) {
            keys[tileID.key] = true;
            this._renderableTilesKeys.push(tileID.key);
            if (!this._tiles[tileID.key]) {
                tileID.terrainRttPosMatrix32f = new Float64Array(16) as any;
                mat4.ortho(tileID.terrainRttPosMatrix32f, 0, EXTENT, EXTENT, 0, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
                this._lastTilesetChange = now();
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
    getTerrainCoords(
        tileID: OverscaledTileID,
        terrainTileRanges?: {[zoom: string]: CanonicalTileRange}
    ): Record<string, OverscaledTileID> {
        if (terrainTileRanges) {
            return this._getTerrainCoordsForTileRanges(tileID, terrainTileRanges);
        } else {
            return this._getTerrainCoordsForRegularTile(tileID);
        }
    }

    /**
     * Searches for the corresponding current renderable terrain-tiles.
     * Includes terrain tiles that are either:
     * - the same as the tileID
     * - a parent of the tileID
     * - a child of the tileID
     * @param tileID - the tile to look for
     * @returns the tiles that were found
     */
    _getTerrainCoordsForRegularTile(tileID: OverscaledTileID): Record<string, OverscaledTileID> {
        const coords: Record<string, OverscaledTileID> = {};
        for (const key of this._renderableTilesKeys) {
            const terrainTileID = this._tiles[key].tileID;
            const coord = tileID.clone();
            const mat = createMat4f64();
            if (terrainTileID.canonical.equals(tileID.canonical)) {
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
            } else if (terrainTileID.canonical.isChildOf(tileID.canonical)) {
                const dz = terrainTileID.canonical.z - tileID.canonical.z;
                const dx = terrainTileID.canonical.x - (terrainTileID.canonical.x >> dz << dz);
                const dy = terrainTileID.canonical.y - (terrainTileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1); // Note: we are using `size` instead of `EXTENT` here
                mat4.translate(mat, mat, [-dx * size, -dy * size, 0]);
            } else if (tileID.canonical.isChildOf(terrainTileID.canonical)) {
                const dz = tileID.canonical.z - terrainTileID.canonical.z;
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
     * Searches for the corresponding current renderable terrain-tiles.
     * Includes terrain tiles that are within terrain tile ranges.
     * @param tileID - the tile to look for
     * @returns the tiles that were found
     */
    _getTerrainCoordsForTileRanges(
        tileID: OverscaledTileID,
        terrainTileRanges: {[zoom: string]: CanonicalTileRange}
    ): Record<string, OverscaledTileID> {
        const coords: Record<string, OverscaledTileID> = {};
        for (const key of this._renderableTilesKeys) {
            const terrainTileID = this._tiles[key].tileID;
            if (!this._isWithinTileRanges(terrainTileID, terrainTileRanges)) {
                continue;
            }

            const coord = tileID.clone();
            const mat = createMat4f64();
            if (terrainTileID.canonical.z === tileID.canonical.z) {
                const dx = tileID.canonical.x - terrainTileID.canonical.x;
                const dy = tileID.canonical.y - terrainTileID.canonical.y;
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
                mat4.translate(mat, mat, [dx * EXTENT, dy * EXTENT, 0]);
            } else if (terrainTileID.canonical.z > tileID.canonical.z) {
                const dz = terrainTileID.canonical.z - tileID.canonical.z;
                // this translation is needed to project tileID to terrainTileID zoom level
                const dx = terrainTileID.canonical.x - (terrainTileID.canonical.x >> dz << dz);
                const dy = terrainTileID.canonical.y - (terrainTileID.canonical.y >> dz << dz);
                // this translation is needed if terrainTileID is not a parent of tileID
                const dx2 = tileID.canonical.x - (terrainTileID.canonical.x >> dz);
                const dy2 = tileID.canonical.y - (terrainTileID.canonical.y >> dz);

                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1);
                mat4.translate(mat, mat, [-dx * size + dx2 * EXTENT, -dy * size + dy2 * EXTENT, 0]);
            } else { // terrainTileID.canonical.z < tileID.canonical.z
                const dz = tileID.canonical.z - terrainTileID.canonical.z;
                // this translation is needed to project tileID to terrainTileID zoom level
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                // this translation is needed if terrainTileID is not a parent of tileID
                const dx2 = (tileID.canonical.x >> dz) - terrainTileID.canonical.x;
                const dy2 = (tileID.canonical.y >> dz) - terrainTileID.canonical.y;

                const size = EXTENT << dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1);
                mat4.translate(mat, mat, [dx * EXTENT + dx2 * size, dy * EXTENT + dy2 * size, 0]);
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
    getSourceTile(tileID: OverscaledTileID, searchForDEM?: boolean): Tile | undefined {
        const source = this.tileManager._source;
        let z = tileID.overscaledZ - this.deltaZoom;
        if (z > source.maxzoom) z = source.maxzoom;
        if (z < source.minzoom) return undefined;
        // cache for tileID to terrain-tileID
        if (!this._sourceTileCache[tileID.key])
            this._sourceTileCache[tileID.key] = tileID.scaledTo(z).key;
        let tile = this.findTileInCaches(this._sourceTileCache[tileID.key]);
        // during tile-loading phase look if parent tiles (with loaded dem) are available.
        if (!tile?.dem && searchForDEM) {
            while (z >= source.minzoom && !tile?.dem)
                tile = this.findTileInCaches(tileID.scaledTo(z--).key);
        }
        return tile;
    }

    findTileInCaches(key: string): Tile | undefined {
        let tile = this.tileManager.getTileByID(key);
        if (tile) {
            return tile;
        }
        tile = this.tileManager._outOfViewCache.getByKey(key);
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

    /**
     * Checks whether a tile is within the canonical tile ranges.
     * @param tileID - Tile to check
     * @param canonicalTileRanges - Canonical tile ranges
     * @returns
     */
    private _isWithinTileRanges(
        tileID: OverscaledTileID,
        canonicalTileRanges: {[zoom: string]: CanonicalTileRange}
    ): boolean {
        return canonicalTileRanges[tileID.canonical.z] &&
            tileID.canonical.x >= canonicalTileRanges[tileID.canonical.z].minTileX &&
            tileID.canonical.x <= canonicalTileRanges[tileID.canonical.z].maxTileX &&
            tileID.canonical.y >= canonicalTileRanges[tileID.canonical.z].minTileY &&
            tileID.canonical.y <= canonicalTileRanges[tileID.canonical.z].maxTileY;
    }
}
