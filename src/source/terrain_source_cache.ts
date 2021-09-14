// @flow

import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import EXTENT from '../data/extent';
import {mat4} from 'gl-matrix';
import {Evented} from '../util/evented';
import Style from '../style/style';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import {PosArray, TriangleIndexArray} from '../data/array_types';
import posAttributes from '../data/pos_attributes';
import SegmentVector from '../data/segment';
import type Transform from '../geo/transform';
import type SourceCache from '../source/source_cache';
import type Context from '../gl/context';
import type Painter from '../render/painter';
import type RasterDEMTileSource from '../source/raster_dem_tile_source';
import type Framebuffer from '../gl/framebuffer';

class TerrainSourceCache extends Evented {
    _style: Style;
    _source: RasterDEMTileSource;
    _sourceCache: SourceCache;
    _tiles: {[_: string]: Tile};
    _loadQueue: Array<any>;
    _coordsFramebuffer: any;
    _fbo: any;
    _mesh: any;
    _coords: Texture;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    meshSize: number;
    exaggeration: number;
    elevationOffset: number;
    coordsIndex: Array<any>;
    qualityFactor: number;
    terrainTileCache: {[_: string]: string};

    /**
     * @param {Style} style
     */
    constructor(style: Style) {
        super();
        this._style = style;
        this._sourceCache = null;
        this._source = null;
        this._tiles = {};
        this._loadQueue = [];
        this._coordsFramebuffer = null;
        this._fbo = null;
        this._coords = null;
        this._mesh = null;
        this.minzoom = 5;
        this.maxzoom = 14;
        this.tileSize = 512;
        this.meshSize = 128;
        this.exaggeration = 1.0;
        this.elevationOffset = 450; // add a global offset of 450m to put the dead-sea into positive values.
        this.coordsIndex = [];
        this.qualityFactor = 2;
        this.terrainTileCache = {};
        style.on("data", e => {
            let tile = e.coord && this.getTerrainTile(e.coord, this._style.map.transform.zoom);
            if (tile) tile.rerender = true;
        });
    }

    /**
     *
     * @param {SourceCache} sourceCache
     * @param options Allowed options are exaggeration, elevationOffset & meshSize
     */
    enable(sourceCache: SourceCache, options?: {exaggeration: boolean; elevationOffset: number; meshSize: number}): void {
        this._sourceCache = sourceCache;
        ['exaggeration', 'elevationOffset', 'meshSize'].forEach(key => {
            if (options && options[key] != undefined) this[key] = options[key]
        });
        this._source = sourceCache._source as RasterDEMTileSource;
        this.minzoom = this._source.minzoom;
        this.maxzoom = this._source.maxzoom;
        if (! this._source.loaded()) this._source.once("data", () => {
            this._loadQueue.forEach(tile => this._source.loadTile(tile, () => this._tileLoaded(tile)));
            this._loadQueue = [];
        });
    }

    /**
     * remove the the 3d terrain from map.
     */
    disable(): void {
        this._sourceCache = this._source = null;
        for (const key in this._tiles) {
            let tile = this._tiles[key];
            tile.textures.forEach(t => t.destroy());
            tile.textures = [];
        }
        for (let s in this._style.sourceCaches) {
            for (let key in this._style.sourceCaches[s]._tiles) {
                this._style.sourceCaches[s]._tiles[key].elevation = {};
            }
        }
        this._tiles = {};
    }

    /**
     * check if terrain is currently activated
     * @return {boolean}
     */
    isEnabled(): boolean {
       return this._sourceCache ? true : false;
    }

    /**
     * Load Terrain Tiles, removes outdated Tiles and update camera elevation.
     */
    update(transform: Transform): void {
        if (! this.isEnabled()) return;
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

    /**
     * get a list of tileIds, which should be rendered in the current scene
     * @param {Transform} transform
     * @return {Array<OverscaledTileID>}
     */
    getRenderableTileIds(transform: Transform): Array<OverscaledTileID> {
        return transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this._source ? this._source.minzoom : this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: true
        });
    }

    /**
     * get a list of tiles, which are loaded and should be rendered in the current scene
     * @param {Transform} transform
     * @returns {Array<Tile>}
     */
    getRenderableTiles(transform: Transform): Array<Tile> {
        return this.getRenderableTileIds(transform).map(tileID => this.getTileByID(tileID.key)).filter(t => t);
    }

    /**
     * get a list of tile-keys which are available in cache
     * @param {Transform} transform
     * @returns {Array<string>}
     */
    getRenderableIds(): Array<string> {
        return Object.values(this._tiles).map(t => t.tileID.key);
    }

    /**
     * get terrain tile by the TileID key
     * @returns {Tile}
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * searches for the corresponding terrain-tile at a given zoomlevel
     * @param {OverscaledTileID} tileID
     * @param {number} zoom
     * @returns {Tile}
     */
    getTerrainTile(tileID: OverscaledTileID, zoom: number): Tile {
        if (this.terrainTileCache[tileID.key]) this.getTileByID(this.terrainTileCache[tileID.key]);
        const z = Math.floor(zoom);
        const canonical = tileID.canonical.z > this.maxzoom ? tileID.scaledTo(this.maxzoom).canonical : tileID.canonical;
        const id = new OverscaledTileID(canonical.z > z ? canonical.z : z, tileID.wrap, canonical.z, canonical.x, canonical.y);
        this.terrainTileCache[tileID.key] = id.scaledTo(z).key;
        return this.getTileByID(this.terrainTileCache[tileID.key]);
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
     * @returns {number}
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        if (!this.isEnabled()) return 0;
        const tile = this.getTileByID(tileID.key);
        let elevation = tile && tile.dem && x >= 0 && y >= 0 && x <= extent && y <= extent //FIXME-3D handle negative coordinates
            ? tile.dem.get(Math.floor(x / extent * tile.dem.dim), Math.floor(y / extent * tile.dem.dim))
            : 0;
        if (elevation > 8191) elevation = 0; // REMOVE: this hack is for MTK data, because of false nodata values
        return (elevation + this.elevationOffset);
    }

    /**
     * get the Elevation for given coordinate multiplied by exaggeration.
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number}
     */
    getElevationWithExaggeration(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        return this.getElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * store all tile-coords in a framebuffer for unprojecting pixel coordinates
     * @param {Painter} painter
     * @returns {Framebuffer}
     */
    getCoordsFramebuffer(painter: Painter): Framebuffer {
        const width = this.isEnabled() ? painter.width / devicePixelRatio : 10;
        const height = this.isEnabled() ? painter.height  / devicePixelRatio : 10;
        if (this._fbo && (this._fbo.width != width || this._fbo.height != height)) {
            this._fbo.destroy();
            delete this._fbo;
        }
        if (! this._fbo) {
            painter.context.activeTexture.set(painter.context.gl.TEXTURE0);
            let texture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            texture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
            this._fbo = painter.context.createFramebuffer(width, height, true);
            this._fbo.colorAttachment.set(texture.texture);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        return this._fbo;
    }

    /**
     * get a list of tiles, loaded after a spezific time
     * @param {Date} time
     * @returns {Array<Tile>}
     */
    tilesAfterTime(time=Date.now()): Array<Tile> {
        return Object.values(this._tiles).filter(t => t.timeLoaded >= time);
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @param {Context} context
     * @returns {Object}
     */
    getTerrainMesh(context: Context) {
        if (this._mesh) return this._mesh;
        const vertexArray = new PosArray(), indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize, delta = EXTENT / meshSize, meshSize2 = meshSize * meshSize;
        for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta);
        for (let y=0; y<meshSize2; y+=meshSize+1) for (let x=0; x<meshSize; x++) {
            indexArray.emplaceBack(x+y, meshSize+x+y+1, meshSize+x+y+2);
            indexArray.emplaceBack(x+y, meshSize+x+y+2, x+y+1);
        }
        return this._mesh = {
            indexBuffer: context.createIndexBuffer(indexArray),
            vertexBuffer: context.createVertexBuffer(vertexArray, posAttributes.members),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
    }

    /**
     * create coords texture, needed to grab coordinates from canvas
     * encode coords coordinate into 4 bytes:
     *   - 8 lower bits for x
     *   - 8 lower bits for y
     *   - 4 higher bits for x
     *   - 4 higher bits for y
     *   - 8 bits for coordsIndex (1 .. 255) (= number of terraintile), is later setted in draw_terrain uniform value
     * @param {Context} context
     * @returns {Texture}
     */
    getCoordsTexture(context: Context): Texture {
        if (this._coords) return this._coords;
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
        return this._coords = texture;
    }

    /**
     * after a tile is loaded:
     *  - recreate terrain-mesh webgl segments
     *  - recalculate elevation of all symbols/circles/buildings of all tiles
     * @param {Tile} tile
     */
    _tileLoaded(tile: Tile): void {
        tile.timeLoaded = Date.now();
        this._style.map.transform.updateElevation();
        if (tile.state == "loaded") {
            if (this._sourceCache) this._sourceCache._backfillDEM.call(this, tile);
            // rerender tile incl. neighboring tiles
            tile.elevationVertexBuffer = null;
            Object.keys(tile.neighboringTiles)
                .map(id => this.getTileByID(id))
                .forEach(tile => { if (tile) tile.elevationVertexBuffer = null });
        }
        // delete elevationdata from coresponding tile, so that they can be reloaded on next rendering
        // FIXME-3D! only delete data from necessary tiles
        for (let s in this._style.sourceCaches) {
            for (let key in this._style.sourceCaches[s]._tiles) {
                this._style.sourceCaches[s]._tiles[key].elevation = {};
            }
        }
    }

    // FIXME-3D! copy terrain-data from parent tile if available
    _createEmptyTile(tileID: OverscaledTileID): Tile {
        tileID.posMatrix = mat4.create();
        mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
        let tile = new Tile(tileID, this.tileSize * tileID.overscaleFactor());
        tile.textures = [];
        return tile;
    }

}

export default TerrainSourceCache;
