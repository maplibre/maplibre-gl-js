
import Tile from '../source/tile';
import {mat4, vec2} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import {RGBAImage} from '../util/image';
import {warnOnce} from '../util/util';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import posAttributes from '../data/pos_attributes';
import SegmentVector from '../data/segment';
import VertexBuffer from '../gl/vertex_buffer';
import IndexBuffer from '../gl/index_buffer';
import Style from '../style/style';
import Texture from '../render/texture';
import type Framebuffer from '../gl/framebuffer';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from '../geo/mercator_coordinate';
import TerrainSourceCache from '../source/terrain_source_cache';
import SourceCache from '../source/source_cache';
import EXTENT from '../data/extent';
import {number as mix} from '../style-spec/util/interpolate';
import type {TerrainSpecification} from '../style-spec/types.g';

export type TerrainData = {
    'u_depth': number;
    'u_terrain': number;
    'u_terrain_dim': number;
    'u_terrain_matrix': mat4;
    'u_terrain_unpack': number[];
    'u_terrain_offset': number;
    'u_terrain_exaggeration': number;
    texture: WebGLTexture;
    depthTexture: WebGLTexture;
    tile: Tile;
}

export type TerrainMesh = {
    indexBuffer: IndexBuffer;
    vertexBuffer: VertexBuffer;
    segments: SegmentVector;
}

/**
 * This is the main class which handles most of the 3D Terrain logic. It has the follwing topics:
 *    1) loads raster-dem tiles via the internal sourceCache this.sourceCache
 *    2) creates a depth-framebuffer, which is used to calculate the visibility of coordinates
 *    3) creates a coords-framebuffer, which is used the get to tile-coordinate for a screen-pixel
 *    4) stores all render-to-texture tiles in the this.sourceCache._tiles
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

export default class Terrain {
    // The style this terrain crresponds to
    style: Style;
    // the sourcecache this terrain is based on
    sourceCache: TerrainSourceCache;
    // the TerrainSpecification object passed to this instance
    options: TerrainSpecification;
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
    // holds the framebuffer object in size of the screen to render the coords & depth into a texture.
    _fbo: Framebuffer;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    // GL Objects for the terrain-mesh
    // The mesh is a regular mesh, which has the advantage that it can be reused for all tiles.
    _mesh: TerrainMesh;
    // coords index contains a list of tileID.keys. This index is used to identify
    // the tile via the alpha-cannel in the coords-texture.
    // As the alpha-channel has 1 Byte a max of 255 tiles can rendered without an error.
    coordsIndex: Array<string>;
    // tile-coords encoded in the rgb channel, _coordsIndex is in the alpha-channel.
    _coordsTexture: Texture;
    // accuracy of the coords. 2 * tileSize should be enoughth.
    _coordsTextureSize: number;
    // variables for an empty dem texture, which is used while the raster-dem tile is loading.
    _emptyDemUnpack: number[];
    _emptyDemTexture: Texture;
    _emptyDemMatrix: mat4;
    // as of overzooming of raster-dem tiles in high zoomlevels, this cache contains
    // matrices to transform from vector-tile coords to raster-dem-tile coords.
    _demMatrixCache: {[_: string]: { matrix: mat4; coord: OverscaledTileID }};
    // because of overzooming raster-dem tiles this cache holds the corresponding
    // framebuffer-object to render tiles to texture
    _rttFramebuffer: Framebuffer;
    // loading raster-dem tiles foreach render-to-texture tile results in loading
    // a lot of terrain-dem tiles with very low visual advantage. So with this setting
    // remember all tiles which contains new data for a spezific source and tile-key.
    _rerender: {[_: string]: {[_: number]: boolean}};

    constructor(style: Style, sourceCache: SourceCache, options: TerrainSpecification) {
        this.style = style;
        this.sourceCache = new TerrainSourceCache(sourceCache);
        this.options = options;
        this.exaggeration = typeof options.exaggeration === 'number' ? options.exaggeration : 1.0;
        this.elevationOffset = typeof options.elevationOffset === 'number' ? options.elevationOffset : 450; // ~ dead-sea
        this.qualityFactor = 2;
        this.meshSize = 128;
        this._demMatrixCache = {};
        this.coordsIndex = [];
        this._coordsTextureSize = 1024;
        this.clearRerenderCache();
    }

    /**
     * get the elevation-value from original dem-data for a given tile-coordinate
     * @param {OverscaledTileID} tileID - the tile to get elevation for
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number} - the elevation
     */
    getDEMElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        if (!(x >= 0 && x < extent && y >= 0 && y < extent)) return this.elevationOffset;
        let elevation = 0;
        const terrain = this.getTerrainData(tileID);
        if (terrain.tile && terrain.tile.dem) {
            const pos = vec2.transformMat4([] as any, [x / extent * EXTENT, y / extent * EXTENT], terrain.u_terrain_matrix);
            const coord = [pos[0] * terrain.tile.dem.dim, pos[1] * terrain.tile.dem.dim];
            const c = [Math.floor(coord[0]), Math.floor(coord[1])];
            const tl = terrain.tile.dem.get(c[0], c[1]);
            const tr = terrain.tile.dem.get(c[0], c[1] + 1);
            const bl = terrain.tile.dem.get(c[0] + 1, c[1]);
            const br = terrain.tile.dem.get(c[0] + 1, c[1] + 1);
            elevation = mix(mix(tl, tr, coord[0] - c[0]), mix(bl, br, coord[0] - c[0]), coord[1] - c[1]);
        }
        return elevation;
    }

    rememberForRerender(source: string, tileID: OverscaledTileID) {
        for (const key in this.sourceCache._tiles) {
            const tile = this.sourceCache._tiles[key];
            if (tile.tileID.equals(tileID) || tile.tileID.isChildOf(tileID)) {
                if (source === this.sourceCache.sourceCache.id) tile.timeLoaded = Date.now();
                this._rerender[source] = this._rerender[source] || {};
                this._rerender[source][tile.tileID.key] = true;
            }
        }
    }

    needsRerender(source: string, tileID: OverscaledTileID) {
        return this._rerender[source] && this._rerender[source][tileID.key];
    }

    clearRerenderCache() {
        this._rerender = {};
    }

    /**
     * get the Elevation for given coordinate in respect of elevationOffset and exaggeration.
     * @param {OverscaledTileID} tileID - the tile id
     * @param {number} x between 0 .. EXTENT
     * @param {number} y between 0 .. EXTENT
     * @param {number} extent optional, default 8192
     * @returns {number} - the elevation
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        return (this.getDEMElevation(tileID, x, y, extent) + this.elevationOffset) * this.exaggeration;
    }

    /**
     * returns a Terrain Object for a tile. Unless the tile corresponds to data (e.g. tile is loading), return a flat dem object
     * @param {OverscaledTileID} tileID - the tile to get the terrain for
     * @returns {TerrainData} the terrain data to use in the program
     */
    getTerrainData(tileID: OverscaledTileID): TerrainData {
        // create empty DEM Obejcts, which will used while raster-dem tiles are loading.
        // creates an empty depth-buffer texture which is needed, during the initialisation process of the 3d mesh..
        if (!this._emptyDemTexture) {
            const context = this.style.map.painter.context;
            const image = new RGBAImage({width: 1, height: 1}, new Uint8Array(1 * 4));
            this._emptyDepthTexture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
            this._emptyDemUnpack = [0, 0, 0, 0];
            this._emptyDemTexture = new Texture(context, new RGBAImage({width: 1, height: 1}), context.gl.RGBA, {premultiply: false});
            this._emptyDemTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            this._emptyDemMatrix = mat4.identity([] as any);
        }
        // find covering dem tile and prepare demTexture
        const sourceTile = this.sourceCache.getSourceTile(tileID, true);
        if (sourceTile && sourceTile.dem && (!sourceTile.demTexture || sourceTile.needsTerrainPrepare)) {
            const context = this.style.map.painter.context;
            sourceTile.demTexture = this.style.map.painter.getTileTexture(sourceTile.dem.stride);
            if (sourceTile.demTexture) sourceTile.demTexture.update(sourceTile.dem.getPixels(), {premultiply: false});
            else sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, {premultiply: false});
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            sourceTile.needsTerrainPrepare = false;
        }
        // create matrix for lookup in dem data
        const matrixKey = sourceTile && (sourceTile + sourceTile.tileID.key) + tileID.key;
        if (matrixKey && !this._demMatrixCache[matrixKey]) {
            const maxzoom = this.sourceCache.sourceCache._source.maxzoom;
            let dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
            if (tileID.overscaledZ > tileID.canonical.z) {
                if (tileID.canonical.z >= maxzoom) dz =  tileID.canonical.z - maxzoom;
                else warnOnce('cannot calculate elevation if elevation maxzoom > source.maxzoom');
            }
            const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
            const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
            const demMatrix = mat4.fromScaling(new Float64Array(16) as any, [1 / (EXTENT << dz), 1 / (EXTENT << dz), 0]);
            mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
            this._demMatrixCache[tileID.key] = {matrix: demMatrix, coord: tileID};
        }
        // return uniform values & textures
        return {
            'u_depth': 2,
            'u_terrain': 3,
            'u_terrain_dim': sourceTile && sourceTile.dem && sourceTile.dem.dim || 1,
            'u_terrain_matrix': matrixKey ? this._demMatrixCache[tileID.key].matrix : this._emptyDemMatrix,
            'u_terrain_unpack': sourceTile && sourceTile.dem && sourceTile.dem.getUnpackVector() || this._emptyDemUnpack,
            'u_terrain_offset': this.elevationOffset,
            'u_terrain_exaggeration': this.exaggeration,
            texture: (sourceTile && sourceTile.demTexture || this._emptyDemTexture).texture,
            depthTexture: (this._fboDepthTexture || this._emptyDepthTexture).texture,
            tile: sourceTile
        };
    }

    /**
     * create the render-to-texture framebuffer
     * @returns {Framebuffer} - the frame buffer
     */
    getRTTFramebuffer() {
        const painter = this.style.map.painter;
        if (!this._rttFramebuffer) {
            const size = this.sourceCache.tileSize * this.qualityFactor;
            this._rttFramebuffer = painter.context.createFramebuffer(size, size, true);
            this._rttFramebuffer.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, size, size));
        }
        return this._rttFramebuffer;
    }

    /**
     * get a framebuffer as big as the map-div, which will be used to render depth & coords into a texture
     * @param {string} texture - the texture
     * @returns {Framebuffer} the frame buffer
     */
    getFramebuffer(texture: string): Framebuffer {
        const painter = this.style.map.painter;
        const width = painter.width / devicePixelRatio;
        const height = painter.height / devicePixelRatio;
        if (this._fbo && (this._fbo.width !== width || this._fbo.height !== height)) {
            this._fbo.destroy();
            this._fboCoordsTexture.destroy();
            this._fboDepthTexture.destroy();
            delete this._fbo;
            delete this._fboDepthTexture;
            delete this._fboCoordsTexture;
        }
        if (!this._fboCoordsTexture) {
            this._fboCoordsTexture = new Texture(painter.context, {width, height, data: null}, painter.context.gl.RGBA, {premultiply: false});
            this._fboCoordsTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fboDepthTexture) {
            this._fboDepthTexture = new Texture(painter.context, {width, height, data: null}, painter.context.gl.RGBA, {premultiply: false});
            this._fboDepthTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fbo) {
            this._fbo = painter.context.createFramebuffer(width, height, true);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        this._fbo.colorAttachment.set(texture === 'coords' ? this._fboCoordsTexture.texture : this._fboDepthTexture.texture);
        return this._fbo;
    }

    /**
     * create coords texture, needed to grab coordinates from canvas
     * encode coords coordinate into 4 bytes:
     *   - 8 lower bits for x
     *   - 8 lower bits for y
     *   - 4 higher bits for x
     *   - 4 higher bits for y
     *   - 8 bits for coordsIndex (1 .. 255) (= number of terraintile), is later setted in draw_terrain uniform value
     * @returns {Texture} - the texture
     */
    getCoordsTexture(): Texture {
        const context = this.style.map.painter.context;
        if (this._coordsTexture) return this._coordsTexture;
        const data = new Uint8Array(this._coordsTextureSize * this._coordsTextureSize * 4);
        for (let y = 0, i = 0; y < this._coordsTextureSize; y++) for (let x = 0; x < this._coordsTextureSize; x++, i += 4) {
            data[i + 0] = x & 255;
            data[i + 1] = y & 255;
            data[i + 2] = ((x >> 8) << 4) | (y >> 8);
            data[i + 3] = 0;
        }
        const image = new RGBAImage({width: this._coordsTextureSize, height: this._coordsTextureSize}, new Uint8Array(data.buffer));
        const texture = new Texture(context, image, context.gl.RGBA, {premultiply: false});
        texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        this._coordsTexture = texture;
        return texture;
    }

    /**
     * Reads a pixel from the coords-framebuffer and translate this to mercator.
     * @param {Point} p Screen-Coordinate
     * @returns {MercatorCoordinate} mercator coordinate for a screen pixel
     */
    pointCoordinate(p: Point): MercatorCoordinate {
        const rgba = new Uint8Array(4);
        const painter = this.style.map.painter, context = painter.context, gl = context.gl;
        // grab coordinate pixel from coordinates framebuffer
        context.bindFramebuffer.set(this.getFramebuffer('coords').framebuffer);
        gl.readPixels(p.x, painter.height / devicePixelRatio - p.y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        context.bindFramebuffer.set(null);
        // decode coordinates (encoding see getCoordsTexture)
        const x = rgba[0] + ((rgba[2] >> 4) << 8);
        const y = rgba[1] + ((rgba[2] & 15) << 8);
        const tileID = this.coordsIndex[255 - rgba[3]];
        const tile = tileID && this.sourceCache.getTileByID(tileID);
        if (!tile) return null;
        const coordsSize = this._coordsTextureSize;
        const worldSize = (1 << tile.tileID.canonical.z) * coordsSize;
        return new MercatorCoordinate(
            (tile.tileID.canonical.x * coordsSize + x) / worldSize,
            (tile.tileID.canonical.y * coordsSize + y) / worldSize,
            this.getElevation(tile.tileID, x, y, coordsSize)
        );
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @returns {TerrainMesh} - the created regular mesh
     */
    getTerrainMesh(): TerrainMesh {
        if (this._mesh) return this._mesh;
        const context = this.style.map.painter.context;
        const vertexArray = new PosArray(), indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize, delta = EXTENT / meshSize, meshSize2 = meshSize * meshSize;
        for (let y = 0; y <= meshSize; y++) for (let x = 0; x <= meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta);
        for (let y = 0; y < meshSize2; y += meshSize + 1) for (let x = 0; x < meshSize; x++) {
            indexArray.emplaceBack(x + y, meshSize + x + y + 1, meshSize + x + y + 2);
            indexArray.emplaceBack(x + y, meshSize + x + y + 2, x + y + 1);
        }
        this._mesh = {
            indexBuffer: context.createIndexBuffer(indexArray),
            vertexBuffer: context.createVertexBuffer(vertexArray, posAttributes.members),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
        return this._mesh;
    }

    /**
     * Get the minimum and maximum elevation contained in a tile. This includes any elevation offset
     * and exaggeration included in the terrain.
     *
     * @param tileID Id of the tile to be used as a source for the min/max elevation
     * @returns {Object} Minimum and maximum elevation found in the tile, including the terrain's
     * elevation offset and exaggeration
     */
    getMinMaxElevation(tileID: OverscaledTileID): {minElevation: number | null; maxElevation: number | null} {
        const tile = this.getTerrainData(tileID).tile;
        const minMax = {minElevation: null, maxElevation: null};
        if (tile && tile.dem) {
            minMax.minElevation = (tile.dem.min + this.elevationOffset) * this.exaggeration;
            minMax.maxElevation = (tile.dem.max + this.elevationOffset) * this.exaggeration;
        }
        return minMax;
    }

}
