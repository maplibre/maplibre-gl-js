// @flow

import {OverscaledTileID} from './tile_id';
import Tile from './tile';
import EXTENT from '../data/extent';
import {mat4, vec2} from 'gl-matrix';
import {Evented} from '../util/evented';
import Style from '../style/style';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import {PosArray, TriangleIndexArray} from '../data/array_types';
import {number as mix} from '../style-spec/util/interpolate.js';
import posAttributes from '../data/pos_attributes';
import SegmentVector from '../data/segment';
import type Transform from '../geo/transform';
import type SourceCache from '../source/source_cache';
import type Context from '../gl/context';
import type Painter from '../render/painter';
import type RasterDEMTileSource from '../source/raster_dem_tile_source';
import type Framebuffer from '../gl/framebuffer';
import { warnOnce } from '../util/util';

class TerrainSourceCache extends Evented {
    _style: Style;
    _source: RasterDEMTileSource;
    _sourceCache: SourceCache;
    _tiles: {[_: string]: Tile};
    _renderableTiles: Array<string>;
    _loadQueue: Array<any>;
    _renderHistory: Array<string>;
    _coordsFramebuffer: any;
    _fbo: any;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    _mesh: any;
    _coordsIndex: Array<any>;
    _coordsTexture: Texture;
    _coordsTextureSize: number;
    _emptyDemUnpack: any;
    _emptyDemTexture: Texture;
    _demMatrixCache: {[_: string]: mat4};
    _sourceTileCache: {[_: string]: string};
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    meshSize: number;
    exaggeration: number;
    elevationOffset: number;
    qualityFactor: number;
    deltaZoom: number;

    /**
     * @param {Style} style
     */
    constructor(style: Style) {
        super();
        this._style = style;
        this._tiles = {};
        this._renderableTiles = [];
        this._loadQueue = [];
        this._renderHistory = [];
        this._demMatrixCache = {};
        this._sourceTileCache = {};
        this._coordsIndex = [];
        this._coordsTextureSize = 1024;
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.meshSize = 128;
        this.exaggeration = 1.0;
        this.elevationOffset = 450; // add a global offset of 450m to put the dead-sea into positive values.
        this.qualityFactor = 2; // render more pixels per tile, value must be a power of two
        this.deltaZoom = 1; // set to a value between 0 and 2 (load load terraintiles in less quality)

        // create empty DEM Obejcts
        const context = style.map.painter.context;
        this._emptyDemUnpack = [0, 0, 0, 0];
        this._emptyDemTexture = new Texture(context, new RGBAImage({width: 1, height: 1}), context.gl.RGBA, {premultiply: false});
        this._emptyDemTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);

        // create empty coordsIndexTexture
        const image = new RGBAImage({width: 1, height: 1}, new Uint8Array(1 * 4));
        const texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        this._emptyDepthTexture = texture;

        // rerender corresponding tiles on source-tile updates
        style.on("data", e => {
            if (e.dataType == "source" && e.coord && this.isEnabled()) {
                const transform = style.map.transform;
                if (e.sourceId == this._sourceCache.id) {
                    for (const key in this._tiles) {
                        const tile = this._tiles[key];
                        // redraw current and overscaled tiles
                        if (tile.tileID.equals(e.coord) || tile.tileID.isChildOf(e.coord)) {
                            tile.timeLoaded = Date.now();
                            tile.clearTextures(this._style.map.painter);
                        }
                    }
                    transform.updateElevation();
                }
            }
        });
    }

    /**
     *
     * @param {SourceCache} sourceCache
     * @param options Allowed options are exaggeration, elevationOffset & meshSize
     */
    enable(sourceCache: SourceCache, options?: {exaggeration: boolean; elevationOffset: number; meshSize: number}): void {
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize * 2 ** this.deltaZoom;
        this._sourceCache = sourceCache;
        ['exaggeration', 'elevationOffset', 'meshSize'].forEach(key => {
            if (options && options[key] != undefined) this[key] = options[key]
        });
    }

    /**
     * remove the the 3d terrain from map.
     */
    disable(): void {
        if (!this._sourceCache) return;
        this._sourceCache.usedForTerrain = false;
        this._sourceCache = null;
        for (const key in this._tiles) {
            let tile = this._tiles[key];
            tile.textures.forEach(t => t.destroy());
            tile.textures = [];
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
        if (!this.isEnabled() || !this._sourceCache._sourceLoaded) return;
        this._sourceCache.update(transform);
        transform.updateElevation();
        this._renderableTiles = [];
        // create tiles for current view
        for (const tileID of this.getRenderableTileIds(transform)) {
            this._renderableTiles.push(tileID.key);
            if (! this._tiles[tileID.key]) {
                tileID.posMatrix = new Float64Array(16) as any;
                mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
            }
        }
        // free GPU memory from old tiles (e.g. remove )
        this._renderHistory = this._renderHistory.filter((i, p) => this._renderHistory.indexOf(i) == p); // remove duplicates
        while (this._renderHistory.length > 100) {
            let tile = this._tiles[this._renderHistory.shift()];
            if (tile) tile.clearTextures(this._style.map.painter);
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
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false
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
     * searches for the corresponding terrain-tiles at a given zoomlevel
     * @param {OverscaledTileID} tileID
     * @param {number} zoom
     * @returns {Tile}
     */
    getTerrainCoords(tileID: OverscaledTileID): {[_: string]: OverscaledTileID} {
        const coords = {};
        for (let key of this._renderableTiles) {
            const _tileID = this._tiles[key].tileID;
            if (_tileID.equals(tileID)) {
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
     * find the covering terrain-dem tile
     * @param {OverscaledTileID} tileID
     * @returns {Tile}
     */
    getSourceTile(tileID: OverscaledTileID): Tile {
        if (!this.isEnabled()) return null;
        if (!this._sourceTileCache[tileID.key]) {
            const maxzoom = this._sourceCache._source.maxzoom;
            const tilezoom = tileID.overscaledZ - this.deltaZoom;
            const z = Math.max(0, tilezoom > maxzoom ? maxzoom : tilezoom);
            this._sourceTileCache[tileID.key] = tileID.scaledTo(z).key;
        }
        return this._sourceCache.getTileByID(this._sourceTileCache[tileID.key]);
    }

    /**
     * returns a Terrain Object for a tile. Unless the tile corresponds to data, return an flat dem object
     * @param {OverscaledTileID} tileID
     */
    getTerrain(tileID?: OverscaledTileID): any {
        if (!this.isEnabled() || !tileID) return null;
        // find covering dem tile and prepare demTexture
        const sourceTile = this.getSourceTile(tileID);
        if (sourceTile && sourceTile.dem && (!sourceTile.demTexture || sourceTile.needsTerrainPrepare)) {
            let context = this._style.map.painter.context;
            sourceTile.demTexture = this._style.map.painter.getTileTexture(sourceTile.dem.stride);
            if (sourceTile.demTexture) sourceTile.demTexture.update(sourceTile.dem.getPixels(), {premultiply: false});
            else sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, {premultiply: false});
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            sourceTile.needsTerrainPrepare = false;
        }
        // create matrix for lookup in dem data
        if (!this._demMatrixCache[tileID.key]) {
            const maxzoom = this._sourceCache._source.maxzoom;
            let dz = tileID.canonical.z - this.deltaZoom <= maxzoom
                ? this.deltaZoom
                : Math.max(0, tileID.canonical.z - maxzoom);
            if (tileID.overscaledZ > tileID.canonical.z) {
                if (tileID.canonical.z >= maxzoom) dz =  tileID.canonical.z - maxzoom;
                else warnOnce("cannot calculate elevation if elevation maxzoom > source.maxzoom")
            }
            const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
            const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
            const demMatrix = mat4.fromScaling(new Float64Array(16) as any, [1 / (EXTENT << dz), 1 / (EXTENT << dz), 0]);
            mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
            this._demMatrixCache[tileID.key] = demMatrix;
         }
        // return uniform values & textures
        return {
            u_depth: 2,
            u_terrain: 3,
            u_terrain_dim: sourceTile && sourceTile.dem && sourceTile.dem.dim || 1,
            u_terrain_matrix: this._demMatrixCache[tileID.key],
            u_terrain_unpack: sourceTile && sourceTile.dem && sourceTile.dem.getUnpackVector() || this._emptyDemUnpack,
            u_terrain_offset: this.elevationOffset,
            u_terrain_exaggeration: this.exaggeration,
            texture: (sourceTile && sourceTile.demTexture || this._emptyDemTexture).texture,
            depthTexture: (this._fboDepthTexture || this._emptyDepthTexture).texture,
            tile: sourceTile
        };
    }

    /**
     * get the Elevation for given coordinate
     * FIXME-3D: handle coordinates outside bounds, e.g. use neighbouring tiles
     * @param {OverscaledTileID} tileID
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number}
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number=EXTENT): number {
        if (!this.isEnabled()) return this.elevationOffset;
        if (!(x >= 0 && x < extent && y >= 0 && y < extent)) return this.elevationOffset;
        let elevation = 0;
        const terrain = this.getTerrain(tileID);
        if (terrain.tile && terrain.tile.dem) {
            const pos = vec2.transformMat4([] as any, [x / extent * EXTENT, y / extent * EXTENT], terrain.u_terrain_matrix);
            const coord = [ pos[0] * terrain.tile.dem.dim, pos[1] * terrain.tile.dem.dim ];
            const c = [ Math.floor(coord[0]), Math.floor(coord[1]) ];
            const tl = terrain.tile.dem.get(c[0], c[1]);
            const tr = terrain.tile.dem.get(c[0], c[1] + 1);
            const bl = terrain.tile.dem.get(c[0] + 1, c[1]);
            const br = terrain.tile.dem.get(c[0] + 1, c[1] + 1);
            elevation = mix(mix(tl, tr, coord[0] - c[0]), mix(bl, br, coord[0] - c[0]), coord[1] - c[1]);
        }
        if (elevation > 8191) elevation = 0; // REMOVEME: this hack is for MTK data, because of false nodata values
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
    getFramebuffer(painter: Painter, texture: string): Framebuffer {
        const width = painter.width / devicePixelRatio;
        const height = painter.height  / devicePixelRatio;
        if (this._fbo && (this._fbo.width != width || this._fbo.height != height)) {
            this._fbo.destroy();
            this._fboCoordsTexture.destroy();
            this._fboDepthTexture.destroy();
            delete this._fbo;
            delete this._fboDepthTexture;
            delete this._fboCoordsTexture;
        }
        if (!this._fboCoordsTexture) {
            this._fboCoordsTexture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            this._fboCoordsTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fboDepthTexture) {
            this._fboDepthTexture = new Texture(painter.context, { width: width, height: height, data: null }, painter.context.gl.RGBA, {premultiply: false});
            this._fboDepthTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (! this._fbo) {
            this._fbo = painter.context.createFramebuffer(width, height, true);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        this._fbo.colorAttachment.set(texture == "coords" ? this._fboCoordsTexture.texture : this._fboDepthTexture.texture);
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
        if (this._coordsTexture) return this._coordsTexture;
        const data = new Uint8Array(this._coordsTextureSize * this._coordsTextureSize * 4);
        for (let y=0, i=0; y<this._coordsTextureSize; y++) for (let x=0; x<this._coordsTextureSize; x++, i+=4) {
            data[i + 0] = x & 255;
            data[i + 1] = y & 255;
            data[i + 2] = ((x >> 8) << 4) | (y >> 8);
            data[i + 3] = 0;
        }
        let image = new RGBAImage({width: this._coordsTextureSize, height: this._coordsTextureSize}, new Uint8Array(data.buffer));
        let texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        return this._coordsTexture = texture;
    }
}

export default TerrainSourceCache;
