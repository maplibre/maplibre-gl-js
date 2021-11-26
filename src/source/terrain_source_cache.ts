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
import VertexBuffer from '../gl/vertex_buffer';
import IndexBuffer from '../gl/index_buffer';


/**
 * This is the main class which handles most of the 3D Terrain logic. It has the follwing topics:
 *    1) loads raster-dem tiles via the internal sourceCache this._source
 *    2) creates a depth-framebuffer, which is used to calculate the visibility of coordinates
 *    3) creates a coords-framebuffer, which is used the get to tile-coordinate for a screen-pixel
 *    4) stores all render-to-texture tiles in the this._tiles variable
 *    5) calculates the elevation for a spezific tile-coordinate
 *    6) creates a terrain-mesh
 *
 *    A note about the GPU resource-usage:
 *    Framebuffers:
 *       - one for the depth & coords framebuffer with the size of the map-div.
 *       - one for rendering a tile to texture with the size of tileSize (= 512x512).
 *    Textures:
 *       - one texture for an empty raster-dem tile with size 1x1
 *       - one texture for an empty depth-buffer, when terrain is disabled with size 1x1
 *       - one texture for an each loaded raster-dem with size of the source.tileSize
 *       - one texture for the coords-framebuffer with the size of the map-div.
 *       - one texture for the depth-framebuffer with the size of the map-div.
 *       - one texture for the encoded tile-coords with the size 2*tileSize (=1024x1024)
 *       - finally for each render-to-texture tile (= this._tiles) a set of textures
 *         for each render stack (The stack-concept is documented in painter.ts).
 *         Normally there exists 1-3 Textures per tile, depending on the stylesheet.
 *         Each Textures has the size 2*tileSize (= 1024x1024). Also there exists a
 *         cache of the last 150 newest rendered tiles.
 *
 */

class TerrainSourceCache extends Evented {
    _style: Style;
    _source: RasterDEMTileSource;
    // source-cache for the raster-dem source.
    _sourceCache: SourceCache;
    // stores all render-to-texture tiles.
    _tiles: {[_: string]: Tile};
    // because _tiles holds, for performance, also previous rendered tiles
    // this variable contains a list of tiles for the current scene.
    _renderableTiles: Array<string>;
    // each time a render-to-texture tile is rendered, its tileID.key is stored into this array
    // each time a screen is rendered, the last 100 rendered tiles will be kept in cache (e.g. this._tiles).
    _renderHistory: Array<string>;
    // holds the framebuffer object in size of the screen to render the coords & depth into a texture.
    _fbo: any;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    // GL Objects for the terrain-mesh
    // The mesh is a regular mesh, which has the advantage that it can be reused for all tiles.
    _mesh: { indexBuffer: IndexBuffer, vertexBuffer: VertexBuffer, segments: SegmentVector };
    // coords index contains a list of tileID.keys. This index is used to identify
    // the tile via the alpha-cannel in the coords-texture.
    // As the alpha-channel has 1 Byte a max of 255 tiles can rendered without an error.
    _coordsIndex: Array<string>;
    // tile-coords encoded in the rgb channel, _coordsIndex is in the alpha-channel.
    _coordsTexture: Texture;
    // accuracy of the coords. 2 * tileSize should be enoughth.
    _coordsTextureSize: number;
    // variables for an empty dem texture, which is used while the raster-dem tile is loading.
    _emptyDemUnpack: any;
    _emptyDemTexture: Texture;
    _emptyDemMatrix: mat4;
    // as of overzooming of raster-dem tiles in high zoomlevels, this cache contains
    // matrices to transform from vector-tile coords to raster-dem-tile coords.
    _demMatrixCache: {[_: string]: { matrix: mat4, coord: OverscaledTileID }};
    // because of overzooming raster-dem tiles this cache holds the corresponding
    // raster-dem-tile for a vector-tile.
    _sourceTileCache: {[_: string]: string};
    // minimum zoomlevel to render the terrain.
    minzoom: number;
    // maximum zoomlevel to render the terrain.
    maxzoom: number;
    // render-to-texture tileSize in scene.
    tileSize: number;
    // define the meshSize per tile.
    meshSize: number;
    // multiplicator for the elevation. Used to make terrain more "extrem".
    exaggeration: number;
    // defines the global offset of putting negative elevations (e.g. dead-sea) into positive values.
    elevationOffset: number;
    // to not see pixels in the render-to-texture tiles it is good to render them bigger
    // this number is the multiplicator (must be a power of 2) for the current tileSize.
    // So to get good results with not too much memory footprint a value of 2 should be fine.
    qualityFactor: number;
    // loading raster-dem tiles foreach render-to-texture tile results in loading
    // a lot of terrain-dem tiles with very low visual advantage. So with this setting
    // the raster-dem tiles will load for the actualZoom - deltaZoom zoom-level.
    deltaZoom: number;
    // framebuffer-object to render tiles to texture
    rttFramebuffer: Framebuffer;

    /**
     * @param {Style} style
     */
    constructor(style: Style) {
        super();
        this._style = style;
        this._tiles = {};
        this._renderableTiles = [];
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
        this.elevationOffset = 450; // ~ dead-sea
        this.qualityFactor = 2;
        this.deltaZoom = 1;

        // create empty DEM Obejcts, which will used while raster-dem tiles will load.
        const context = style.map.painter.context;
        this._emptyDemUnpack = [0, 0, 0, 0];
        this._emptyDemTexture = new Texture(context, new RGBAImage({width: 1, height: 1}), context.gl.RGBA, {premultiply: false});
        this._emptyDemTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        this._emptyDemMatrix = mat4.identity([] as any);

        // creates an empty depth-buffer texture which is needed, during the initialisation process of the 3d mesh..
        const image = new RGBAImage({width: 1, height: 1}, new Uint8Array(1 * 4));
        const texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        this._emptyDepthTexture = texture;

        // create the render-to-texture framebuffer
        const size = this.tileSize * this.qualityFactor;
        this.rttFramebuffer = context.createFramebuffer(size, size, true);
        this.rttFramebuffer.depthAttachment.set(context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, size, size));

        // rerender corresponding tiles on terrain-dem source-tile updates
        style.on("data", e => {
            if (e.dataType == "source" && e.coord && this.isEnabled()) {
                const transform = style.map.transform;
                if (e.sourceId == this._sourceCache.id) {
                    // redraw current and overscaled terrain-tiles
                    for (const key in this._tiles) {
                        const tile = this._tiles[key];
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
     * Loads a 3D terrain-mesh
     * @param {SourceCache} sourceCache
     * @param options Allowed options are exaggeration & elevationOffset
     */
    enable(sourceCache: SourceCache, options?: {exaggeration: boolean; elevationOffset: number}): void {
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize * 2 ** this.deltaZoom;
        this._sourceCache = sourceCache;
        ['exaggeration', 'elevationOffset'].forEach(key => {
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
     * Load Terrain Tiles, create internal render-to-texture tiles, free GPU memory.
     * @param {Transform} transform
     */
    update(transform: Transform): void {
        if (!this.isEnabled() || !this._sourceCache._sourceLoaded) return;
        // load raster-dem tiles for the current scene.
        this._sourceCache.update(transform);
        this._renderableTiles = [];
        const tileIDs = {};
        // create internal render-to-texture tiles for the current scene.
        for (const tileID of transform.coveringTiles({
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false
        })) {
            this._renderableTiles.push(tileID.key);
            tileIDs[tileID.key] = true;
            if (! this._tiles[tileID.key]) {
                tileID.posMatrix = new Float64Array(16) as any;
                mat4.ortho(tileID.posMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
            }
        }
        // remove duplicates from _renderHistory
        this._renderHistory = this._renderHistory.filter((i, p) => this._renderHistory.indexOf(i) == p);
        // free (GPU) memory from previously rendered not needed tiles
        while (this._renderHistory.length > 150) {
            let tile = this._tiles[this._renderHistory.shift()];
            if (tile && !tileIDs[tile.tileID.key]) {
               tile.clearTextures(this._style.map.painter);
               delete(this._tiles[tile.tileID.key]);
            }
        }
    }

    /**
     * get a list of tiles, which are loaded and should be rendered in the current scene
     * @returns {Array<Tile>}
     */
    getRenderableTiles(): Array<Tile> {
        return this._renderableTiles.map(key => this.getTileByID(key));
    }

    /**
     * get terrain tile by the TileID key
     * @returns {Tile}
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * searches for the corresponding current rendered terrain-tiles
     * @param {OverscaledTileID} tileID
     * @returns {[_:string]: Tile}
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
     * find the covering raster-dem tile
     * @param {OverscaledTileID} tileID
     * @param {boolean} searchForDEM Optinal parameter to search for (parent) souretiles with loaded dem.
     * @returns {Tile}
     */
    getSourceTile(tileID: OverscaledTileID, searchForDEM?: boolean): Tile {
        if (!this.isEnabled()) return null;
        const source = this._sourceCache._source;
        let z = tileID.overscaledZ - this.deltaZoom;
        if (z > source.maxzoom) z = source.maxzoom;
        if (z < source.minzoom) return null;
        // cache for tileID to terrain-tileID
        if (!this._sourceTileCache[tileID.key])
            this._sourceTileCache[tileID.key] = tileID.scaledTo(z).key;
        let tile = this._sourceCache.getTileByID(this._sourceTileCache[tileID.key]);
        // during tile-loading phase look if parent tiles (with loaded dem) are available.
        if (!(tile && tile.dem) && searchForDEM)
            while (z > source.minzoom && !(tile && tile.dem))
                tile = this._sourceCache.getTileByID(tileID.scaledTo(z--).key);
        return tile;
    }

    /**
     * returns a Terrain Object for a tile. Unless the tile corresponds to data, return an flat dem object
     * @param {OverscaledTileID} tileID
     */
    getTerrain(tileID?: OverscaledTileID): any {
        if (!this.isEnabled() || !tileID) return null;
        // find covering dem tile and prepare demTexture
        const sourceTile = this.getSourceTile(tileID, true);
        if (sourceTile && sourceTile.dem && (!sourceTile.demTexture || sourceTile.needsTerrainPrepare)) {
            let context = this._style.map.painter.context;
            sourceTile.demTexture = this._style.map.painter.getTileTexture(sourceTile.dem.stride);
            if (sourceTile.demTexture) sourceTile.demTexture.update(sourceTile.dem.getPixels(), {premultiply: false});
            else sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, {premultiply: false});
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            sourceTile.needsTerrainPrepare = false;
        }
        // create matrix for lookup in dem data
        const matrixKey = sourceTile && (sourceTile + sourceTile.tileID.key) + tileID.key;
        if (matrixKey && !this._demMatrixCache[matrixKey]) {
            const maxzoom = this._sourceCache._source.maxzoom;
            let dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
            if (tileID.overscaledZ > tileID.canonical.z) {
                if (tileID.canonical.z >= maxzoom) dz =  tileID.canonical.z - maxzoom;
                else warnOnce("cannot calculate elevation if elevation maxzoom > source.maxzoom")
            }
            const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
            const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
            const demMatrix = mat4.fromScaling(new Float64Array(16) as any, [1 / (EXTENT << dz), 1 / (EXTENT << dz), 0]);
            mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
            this._demMatrixCache[tileID.key] = { matrix: demMatrix, coord: tileID };
         }
        // return uniform values & textures
        return {
            u_depth: 2,
            u_terrain: 3,
            u_terrain_dim: sourceTile && sourceTile.dem && sourceTile.dem.dim || 1,
            u_terrain_matrix: matrixKey ? this._demMatrixCache[tileID.key].matrix : this._emptyDemMatrix,
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
        if (!this.isEnabled()) return 0.0;
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
        if (!this.isEnabled()) return 0.0;
        return this.getElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * get a framebuffer as big as the map-div, which will be used to render depth & coords into a texture
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
     * get a list of tiles, loaded after a spezific time. This is used to update depth & coords framebuffers.
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
