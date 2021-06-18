// @flow

import type {Source} from './source';
import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import EXTENT from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import Style from '../style/style';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import { extent } from 'd3';
import DEMData from '../data/dem_data';

class TerrainSourceCache extends Evented {

    constructor(style: Style) {
        this._style = style;
        this._sourceCache = null;
        this._source = null;
        this._tiles = [];
        this._coordsIndex = {};
        this._loadQueue = [];
        this._coordsFramebuffer = null;
        this.minzoom = 5;
        this.maxzoom = 14;
        this.tileSize = 512;
        this.meshSize = 32;
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
        let idealTileIDs = this.getRenderableTileIds(transform).filter(id => !this._tiles[id.key]);
        for (const tileID of idealTileIDs) {
            let tile = this._tiles[tileID.key] = this._createEmptyTile(tileID);
            this._coordsIndex[tile._coordsIndex] = tile;
            if (this._source && this._source.loaded()) {
                this._source.loadTile(tile, () => this._tileLoaded(tile));
            } else {
                this._loadQueue.push(tile); // remember for loading later
            }
        }
    }

    getRenderableTileIds(transform: Transform) {
        return transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this._source ? this._source.minzoom : this.minzoom,
            maxzoom: 14,
            reparseOverscaled: true
        });
    }

    getRenderableIds() {
       return Object.values(this._tiles).map(t => t.tileID.key);
    }

    /**
     * get terrain tile by the TileID key
     * @private
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * get the Elevation for given coordinate
     * FIXME-3D:
     *   - make linear interpolation
     *   - handle negative coordinates
     *   - interploate below ZL 14
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        let tile = this.getTileByID(tileID.key);
        return tile && tile.dem && x >= 0 && y >= 0 && x <= extent && y <= extent //FIXME-3D handle negative coordinates
           ? tile.dem.get(Math.floor(x / extent * tile.dem.dim), Math.floor(y / extent * tile.dem.dim))
           : 0;
    }

    /**
     * store all tile-coords in a framebuffer for unprojecting pixel coordinates
     * FIXME-3D resize texture on window-resize
     */
    getCoordsFramebuffer(context: Context) {
        if (! this.fbo) {
            context.activeTexture.set(context.gl.TEXTURE0);
            let texture = new Texture(context, { width: 2024, height: 2024, data: null }, context.gl.RGBA, {premultiply: false});
            texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            this.fbo = context.createFramebuffer(2024, 2024, false);
            this.fbo.colorAttachment.set(texture.texture);
        }
        return this.fbo;
    }

    /**
     * after a tile is loaded:
     *  - recreate terrain-mesh webgl segments
     *  - recalculate elevation of all symbols of all tiles
     * @param {Tile} tile
     */
    _tileLoaded(tile: Tile) {
        if (tile.state == "loaded") {
            if (this._sourceCache) this._sourceCache._backfillDEM.call(this, tile);
            // rerender tile incl. neighboring tiles
            tile.segments = null;
            Object.keys(tile.neighboringTiles)
               .map(id => this.getTileByID(id))
               .forEach(tile => { if (tile) tile.segments = null });
        }
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
        // create coords texture, needed to grab coordianates from canvas
        // encode coords coordinate into 4 bytes:
        //   - 13 bits for coordsIndex (0 .. 8191) (= number of loaded terraintile)
        //   - 9 bits for y (0 .. 511)
        //   - 9 bits for x (0 .. 511)
        //   - 1 bit for always true in alpha channel, because webgl do not render for opacity 0
        tile._coordsIndex = Object.keys(this._coordsIndex).length + 1; // create unique coords index
        const data = new Uint8Array(this.tileSize * this.tileSize * 4);
        for (let x=0, i=0; x<this.tileSize; x++) for (let y=0; y<this.tileSize; y++, i+=4) {
           data[i + 3] = ((x & 127) << 1) | 1;
           data[i + 2] = (y << 2) | (x >> 7);
           data[i + 1] = ((tile._coordsIndex & 31) << 3) | (y >> 6);
           data[i + 0] = tile._coordsIndex >> 5;
        }
        tile.coords = new RGBAImage({width: this.tileSize, height: this.tileSize}, new Uint8Array(data.buffer));
        return tile;
    }

}
export default TerrainSourceCache;
