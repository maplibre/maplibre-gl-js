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
import browser from '../util/browser';
import {PosArray, TriangleIndexArray} from '../data/array_types';
import posAttributes from '../data/pos_attributes';
import SegmentVector from '../data/segment';

class TerrainSourceCache extends Evented {

    constructor(style: Style) {
        this._style = style;
        this._sourceCache = null;
        this._source = null;
        this._tiles = [];
        this._loadQueue = [];
        this._coordsFramebuffer = null;
        this._rerender = true;
        this.minzoom = 5;
        this.maxzoom = 14;
        this.tileSize = 512;
        this.meshSize = 128;
        this.exaggeration = 1.0;
        this.coordsIndex = [];
        style.on("data", () => this._rerender = true);
    }

    setSourceCache(sourceCache: Source) {
        this._sourceCache = sourceCache;
        this._source = sourceCache._source;
        if (! this._source.loaded()) this._source.once("data", () => {
           this._loadQueue.forEach(tile => this._source.loadTile(tile, () => this._tileLoaded(tile)));
           this._loadQueue = [];
        });
    }

    /**
     * Creates a singletop terrain-mesh
     * Removes tiles that are outside the viewport and adds new tiles that are inside the viewport.
     * @private
     */
    update(transform: Transform, context: Context) {
        transform.updateElevation();
        let idealTileIDs = this.getRenderableTileIds(transform);
        let outdated = {};
        Object.keys(this._tiles).forEach(key => outdated[key] = true);
        for (const tileID of idealTileIDs) {
            delete(outdated[tileID.key]);
            if (this._tiles[tileID.key]) continue;
            let tile = this._tiles[tileID.key] = this._createEmptyTile(tileID);
            if (this._source && this._source.loaded()) {
                this._source.loadTile(tile, () => this._tileLoaded(tile));
            } else {
                this._loadQueue.push(tile); // remember for loading later
            }
        }
        for (const key in outdated) {
           let tile = this._tiles[key];
           tile.textures.forEach(t => t.destroy());
           tile.textures = [];
        }
    }

    getRenderableTileIds(transform: Transform) {
        return transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this._source ? this._source.minzoom : this.minzoom,
            maxzoom: this.maxzoom,
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
        const tile = this.getTileByID(tileID.key);
        const elevation = tile && tile.dem && x >= 0 && y >= 0 && x <= extent && y <= extent //FIXME-3D handle negative coordinates
           ? tile.dem.get(Math.floor(x / extent * tile.dem.dim), Math.floor(y / extent * tile.dem.dim))
           : 0;
        return (elevation + 450); // add a global offset of 450m to put the dead-sea into positive values.
    }

    /**
     * get the Elevation for given coordinate multiplied by exaggeration.
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     */
    getElevationWithExaggeration(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        return this.getElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * store all tile-coords in a framebuffer for unprojecting pixel coordinates
     * FIXME-3D resize texture on window-resize
     */
    getCoordsFramebuffer(painter: Painter) {
        const width = painter.width / browser.devicePixelRatio;
        const height = painter.height  / browser.devicePixelRatio;
        if (this.fbo && (this.fbo.width != width || this.fbo.height != height)) {
            this.fbo.destroy();
            delete this.fbo;
        }
        if (! this.fbo) {
            painter.context.activeTexture.set(painter.context.gl.TEXTURE0);
            let texture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            texture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
            this.fbo = painter.context.createFramebuffer(width, height, true);
            this.fbo.colorAttachment.set(texture.texture);
            this.fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        return this.fbo;
    }

    /**
     * get a list of tiles, loaded after a spezific time
     * @param {Date} time
     */
    tilesForTime(time=Date.now()) {
        return Object.values(this._tiles).filter(t => t.loadTime >= time);
    }

    // create a regular mesh which will be used by all terrain-tiles
    getTerrainMesh(context: Context) {
        if (this.mesh) return this.mesh;
        const vertexArray = new PosArray(), indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize, delta = EXTENT / meshSize, meshSize2 = meshSize * meshSize;
        for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta);
        for (let y=0; y<meshSize2; y+=meshSize+1) for (let x=0; x<meshSize; x++) {
            indexArray.emplaceBack(x+y, meshSize+x+y+1, meshSize+x+y+2);
            indexArray.emplaceBack(x+y, meshSize+x+y+2, x+y+1);
        }
        return this.mesh = {
            indexBuffer: context.createIndexBuffer(indexArray),
            vertexBuffer: context.createVertexBuffer(vertexArray, posAttributes.members),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
    }

    // create coords texture, needed to grab coordianates from canvas
    // encode coords coordinate into 4 bytes:
    //   - 8 lower bits for x
    //   - 8 lower bits for y
    //   - 4 higher bits for x
    //   - 4 higher bits for y
    //   - 8 bits for coordsIndex (1 .. 256) (= number of terraintile), is later setted in draw_terrain uniform value
    getCoordsTexture(context: Context) {
        if (this.coords) return this.coords;
        const data = new Uint8Array(4096 * 4096 * 4);
        for (let y=0, i=0; y<4096; y++) for (let x=0; x<4096; x++, i+=4) {
           data[i + 0] = x & 255;
           data[i + 1] = y & 255;
           data[i + 2] = ((x >> 8) << 4) | (y >> 8);
           data[i + 3] = 0;
        }
        let image = new RGBAImage({width: 4096, height: 4096}, new Uint8Array(data.buffer));
        let texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        return this.coords = texture;
    }

    /**
     * after a tile is loaded:
     *  - recreate terrain-mesh webgl segments
     *  - recalculate elevation of all symbols/circles/buildings of all tiles
     * @param {Tile} tile
     */
    _tileLoaded(tile: Tile) {
        tile.loadTime = Date.now();
        if (tile.state == "loaded") {
            if (this._sourceCache) this._sourceCache._backfillDEM.call(this, tile);
            // rerender tile incl. neighboring tiles
            tile.elevationVertexBuffer = null;
            Object.keys(tile.neighboringTiles)
               .map(id => this.getTileByID(id))
               .forEach(tile => { if (tile) tile.elevationVertexBuffer = null });
        }
        // mark all tiles to refetch elevation-data
        // FIXME! only mark necessary tiles
        for (let s in this._style.sourceCaches) {
           for (let key in this._style.sourceCaches[s]._tiles) {
              this._style.sourceCaches[s]._tiles[key].elevation = {};
           }
        }
    }

    _createEmptyTile(tileID: OverscaledTileID) {
        tileID.posMatrix = mat4.create();
        mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
        let tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor());
        tile.textures = [];
        return tile;
    }

}
export default TerrainSourceCache;
