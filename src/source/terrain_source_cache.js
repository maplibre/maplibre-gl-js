// @flow

import type {Source} from './source';
import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import {Pos3DArray, TriangleIndexArray} from '../data/array_types';
import EXTENT from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import Style from '../style/style';

class TerrainSourceCache extends Evented {

    constructor(style: Style) {
        this._style = style;
        this._sourceCache = null;
        this._source = null;
        this._tiles = [];
        this._loadQueue = [];
        this.minzoom = 5;
        this.maxzoom = 14;
        this.tileSize = 512;
    }

    setSourceCache(sourceCache: Source) {
        this._sourceCache = sourceCache;
        this._source = sourceCache._source;
        if (! this._source.loaded()) this._source.once("data", () => this._loadQueue.forEach(tile => {
            this._source.loadTile(tile, () => this._tileLoaded(tile));
        }));
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that are inside the viewport.
     * @private
     */
    update(transform: Transform, context: Context) {
        let idealTileIDs = this.getRenderableTileIDs(transform).filter(id => !this._tiles[id.key]);
        for (const tileID of idealTileIDs) {
            let tile = this._tiles[tileID.key] = this._createEmptyTile(tileID);
            if (this._source && this._source.loaded()) {
                this._source.loadTile(tile, () => this._tileLoaded(tile));
            } else {
                this._loadQueue.push(tile); // remember for loading later
            }
        }
    }

    getRenderableTileIDs(transform: Transform) {
        return transform.coveringTiles({ tileSize: 512, minzoom: this.minzoom, maxzoom: this.maxzoom });
    }

    /**
     * get terrain tile by the x/y/z coordinate.
     * FIXME-3D! may speedup with separate lookup-table
     * @private
     */
    getTileByCanonical(tileID: CanonicalTileID): Tile {
        for (let key in this._tiles)
            if (tileID.equals(this._tiles[key].tileID.canonical))
                return this._tiles[key];
        return null;
    }

    /**
     * get terrain tile by the TileID key
     * @private
     */
    getTileByID(tileID: OverscaledTileID): Tile {
        return this._tiles[tileID.key];
    }

    /**
     * get the Elevation for given coordinate
     * FIXME-3D: make linear interpolation
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number): number {
        let dz = tileID.overscaledZ > this.maxzoom ? tileID.overscaledZ - this.maxzoom : 0;
        let tile = this.getTileByCanonical(tileID.scaledTo(tileID.overscaledZ - dz).canonical);
        return tile && tile.dem && x > 0 && y > 0 //FIXME-3D handle negative coordinates
           ? tile.dem.get(Math.floor(x / EXTENT * tile.dem.dim), Math.floor(y / EXTENT * tile.dem.dim))
           : 0;
    }

    /**
     * after a tile is loaded:
     *  - recreate terrain-mesh webgl segments
     *  - recalculate elevation of all symbols of all tiles
     * @param {Tile} tile
     */
    _tileLoaded(tile: Tile) {
        if (tile.state == "loaded") tile.segments = null;
        for (let s in this._style.sourceCaches) {
           for (let key in this._style.sourceCaches[s]._tiles) {
              let t = this._style.sourceCaches[s]._tiles[key];
              if (t && t.hasSymbolBuckets) t.hasElevation = false;
           }
        }
    }

    _createEmptyTile(tileID: OverscaledTileID) {
        tileID.posMatrix = mat4.create();
        mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
        let tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor());
        const vertexArray = new Pos3DArray(), indexArray = new TriangleIndexArray();
        // create an empty terrain-mesh. (e.g. 2 flat triangles)
        // FIXME-3D: get elevation from parent/children or surrounding tiles
        [[1, 1, 0], [0, 0, 0], [0, 1, 0], [1, 0, 0]].forEach(xy => vertexArray.emplaceBack(...xy.map(c => c * EXTENT)));
        [[1, 0, 3], [0, 1, 2]].forEach(xyz => indexArray.emplaceBack(...xyz))
        tile.mesh = { indexArray: indexArray, vertexArray: vertexArray };
        return tile;
    }

}
export default TerrainSourceCache;
