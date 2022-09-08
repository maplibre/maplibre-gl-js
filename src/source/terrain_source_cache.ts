import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import EXTENT from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import type Transform from '../geo/transform';
import type SourceCache from '../source/source_cache';
import Painter from '../render/painter';
import Terrain from '../render/terrain';

/**
 * This class is a helper for the Terrain-class, it:
 *   - loads raster-dem tiles
 *   - manages all renderToTexture tiles.
 *   - caches previous rendered tiles.
 *   - finds all necessary renderToTexture tiles for a OverscaledTileID area
 *   - finds the corresponding raster-dem tile for OverscaledTileID
 */

export default class TerrainSourceCache extends Evented {
    // source-cache for the raster-dem source.
    sourceCache: SourceCache;
    // stores all render-to-texture tiles.
    _tiles: {[_: string]: Tile};
    // contains a list of tileID-keys for the current scene. (only for performance)
    _renderableTilesKeys: Array<string>;
    // raster-dem-tile for a TileID cache.
    _sourceTileCache: {[_: string]: string};
    // minimum zoomlevel to render the terrain.
    minzoom: number;
    // maximum zoomlevel to render the terrain.
    maxzoom: number;
    // render-to-texture tileSize in scene.
    tileSize: number;
    // raster-dem tiles will load for performance the actualZoom - deltaZoom zoom-level.
    deltaZoom: number;
    // each time a render-to-texture tile is rendered, its tileID.key is stored into this array
    renderHistory: Array<string>;
    // maximal size of render-history
    renderHistorySize: number;

    constructor(sourceCache: SourceCache) {
        super();
        this.sourceCache = sourceCache;
        this._tiles = {};
        this._renderableTilesKeys = [];
        this._sourceTileCache = {};
        this.renderHistory = [];
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.deltaZoom = 1;
        this.renderHistorySize = sourceCache._cache.max;
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize * 2 ** this.deltaZoom;
    }

    destruct() {
        this.sourceCache.usedForTerrain = false;
        this.sourceCache.tileSize = null;
        for (const key in this._tiles) {
            const tile = this._tiles[key];
            tile.textures.forEach(t => t.destroy());
            tile.textures = [];
        }
    }

    /**
     * Load Terrain Tiles, create internal render-to-texture tiles, free GPU memory.
     * @param {Transform} transform - the operation to do
     * @param {Terrain} terrain - the terrain
     */
    update(transform: Transform, terrain: Terrain): void {
        // load raster-dem tiles for the current scene.
        this.sourceCache.update(transform, terrain);
        // create internal render-to-texture tiles for the current scene.
        this._renderableTilesKeys = [];
        for (const tileID of transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false,
            terrain
        })) {
            this._renderableTilesKeys.push(tileID.key);
            if (!this._tiles[tileID.key]) {
                tileID.posMatrix = new Float64Array(16) as any;
                mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
            }
        }
    }

    /**
     * This method should called before each render-to-texture step to free old cached tiles
     * @param {Painter} painter - the painter
     */
    removeOutdated(painter: Painter) {
        // create lookuptable for actual needed tiles
        const tileIDs = {};
        // remove duplicates from renderHistory and chop to renderHistorySize
        this.renderHistory = this.renderHistory.filter((i, p) => {
            return this.renderHistory.indexOf(i) === p;
        }).slice(0, this.renderHistorySize);
        // fill lookuptable with current rendered tiles
        for (const key of this._renderableTilesKeys) tileIDs[key] = true;
        // fill lookuptable with most recent rendered tiles outside the viewport
        for (const key of this.renderHistory) tileIDs[key] = true;
        // free (GPU) memory from previously rendered not needed tiles
        for (const key in this._tiles) {
            if (!tileIDs[key]) {
                this._tiles[key].clearTextures(painter);
                delete this._tiles[key];
            }
        }
    }

    /**
     * get a list of tiles, which are loaded and should be rendered in the current scene
     * @returns {Array<Tile>} the renderable tiles
     */
    getRenderableTiles(): Array<Tile> {
        return this._renderableTilesKeys.map(key => this.getTileByID(key));
    }

    /**
     * get terrain tile by the TileID key
     * @param id - the tile id
     * @returns {Tile} - the tile
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * Searches for the corresponding current renderable terrain-tiles
     * @param {OverscaledTileID} tileID - the tile to look for
     * @returns {Record<string, OverscaledTileID>} - the tiles that were found
     */
    getTerrainCoords(tileID: OverscaledTileID): Record<string, OverscaledTileID> {
        const coords = {};
        for (const key of this._renderableTilesKeys) {
            const _tileID = this._tiles[key].tileID;
            if (_tileID.canonical.equals(tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                mat4.ortho(coord.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                coords[key] = coord;
            } else if (_tileID.canonical.isChildOf(tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                const dz = _tileID.canonical.z - tileID.canonical.z;
                const dx = _tileID.canonical.x - (_tileID.canonical.x >> dz << dz);
                const dy = _tileID.canonical.y - (_tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(coord.posMatrix, 0, size, 0, size, 0, 1);
                mat4.translate(coord.posMatrix, coord.posMatrix, [-dx * size, -dy * size, 0]);
                coords[key] = coord;
            } else if (tileID.canonical.isChildOf(_tileID.canonical)) {
                const coord = tileID.clone();
                coord.posMatrix = new Float64Array(16) as any;
                const dz = tileID.canonical.z - _tileID.canonical.z;
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(coord.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                mat4.translate(coord.posMatrix, coord.posMatrix, [dx * size, dy * size, 0]);
                mat4.scale(coord.posMatrix, coord.posMatrix, [1 / (2 ** dz), 1 / (2 ** dz), 0]);
                coords[key] = coord;
            }
        }
        return coords;
    }

    /**
     * find the covering raster-dem tile
     * @param {OverscaledTileID} tileID - the tile to look for
     * @param {boolean} searchForDEM Optinal parameter to search for (parent) souretiles with loaded dem.
     * @returns {Tile} - the tile
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
     * get a list of tiles, loaded after a spezific time. This is used to update depth & coords framebuffers.
     * @param {Date} time - the time
     * @returns {Array<Tile>} - the relevant tiles
     */
    tilesAfterTime(time = Date.now()): Array<Tile> {
        return Object.values(this._tiles).filter(t => t.timeLoaded >= time);
    }
}
