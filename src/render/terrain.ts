
import {Tile} from '../source/tile';
import {mat4, vec2} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import {RGBAImage} from '../util/image';
import {warnOnce} from '../util/util';
import {Pos3dArray, TriangleIndexArray} from '../data/array_types.g';
import pos3dAttributes from '../data/pos3d_attributes';
import {SegmentVector} from '../data/segment';
import {VertexBuffer} from '../gl/vertex_buffer';
import {IndexBuffer} from '../gl/index_buffer';
import {Painter} from './painter';
import {Texture} from '../render/texture';
import type {Framebuffer} from '../gl/framebuffer';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate, lngFromMercatorX, mercatorXfromLng} from '../geo/mercator_coordinate';
import {TerrainSourceCache} from '../source/terrain_source_cache';
import {SourceCache} from '../source/source_cache';
import {EXTENT} from '../data/extent';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import {LngLat, earthRadius} from '../geo/lng_lat';

/**
 * @internal
 * A terrain GPU related object
 */
export type TerrainData = {
    'u_depth': number;
    'u_terrain': number;
    'u_terrain_dim': number;
    'u_terrain_matrix': mat4;
    'u_terrain_unpack': number[];
    'u_terrain_exaggeration': number;
    texture: WebGLTexture;
    depthTexture: WebGLTexture;
    tile: Tile;
}

/**
 * @internal
 * A terrain mesh object
 */
export type TerrainMesh = {
    indexBuffer: IndexBuffer;
    vertexBuffer: VertexBuffer;
    segments: SegmentVector;
}

/**
 * @internal
 * This is the main class which handles most of the 3D Terrain logic. It has the following topics:
 *    1) loads raster-dem tiles via the internal sourceCache this.sourceCache
 *    2) creates a depth-framebuffer, which is used to calculate the visibility of coordinates
 *    3) creates a coords-framebuffer, which is used the get to tile-coordinate for a screen-pixel
 *    4) stores all render-to-texture tiles in the this.sourceCache._tiles
 *    5) calculates the elevation for a specific tile-coordinate
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
export class Terrain {
    /**
     * The style this terrain crresponds to
     */
    painter: Painter;
    /**
     * the sourcecache this terrain is based on
     */
    sourceCache: TerrainSourceCache;
    /**
     * the TerrainSpecification object passed to this instance
     */
    options: TerrainSpecification;
    /**
     * define the meshSize per tile.
     */
    meshSize: number;
    /**
     * multiplicator for the elevation. Used to make terrain more "extreme".
     */
    exaggeration: number;
    /**
     * to not see pixels in the render-to-texture tiles it is good to render them bigger
     * this number is the multiplicator (must be a power of 2) for the current tileSize.
     * So to get good results with not too much memory footprint a value of 2 should be fine.
     */
    qualityFactor: number;
    /**
     * holds the framebuffer object in size of the screen to render the coords & depth into a texture.
     */
    _fbo: Framebuffer;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    /**
     * GL Objects for the terrain-mesh
     * The mesh is a regular mesh, which has the advantage that it can be reused for all tiles.
     */
    _mesh: TerrainMesh;
    /**
     * coords index contains a list of tileID.keys. This index is used to identify
     * the tile via the alpha-cannel in the coords-texture.
     * As the alpha-channel has 1 Byte a max of 255 tiles can rendered without an error.
     */
    coordsIndex: Array<string>;
    /**
     * tile-coords encoded in the rgb channel, _coordsIndex is in the alpha-channel.
     */
    _coordsTexture: Texture;
    /**
     * accuracy of the coords. 2 * tileSize should be enoughth.
     */
    _coordsTextureSize: number;
    /**
     * variables for an empty dem texture, which is used while the raster-dem tile is loading.
     */
    _emptyDemUnpack: number[];
    _emptyDemTexture: Texture;
    _emptyDemMatrix: mat4;
    /**
     * as of overzooming of raster-dem tiles in high zoomlevels, this cache contains
     * matrices to transform from vector-tile coords to raster-dem-tile coords.
     */
    _demMatrixCache: {[_: string]: { matrix: mat4; coord: OverscaledTileID }};

    constructor(painter: Painter, sourceCache: SourceCache, options: TerrainSpecification) {
        this.painter = painter;
        this.sourceCache = new TerrainSourceCache(sourceCache);
        this.options = options;
        this.exaggeration = typeof options.exaggeration === 'number' ? options.exaggeration : 1.0;
        this.qualityFactor = 2;
        this.meshSize = 128;
        this._demMatrixCache = {};
        this.coordsIndex = [];
        this._coordsTextureSize = 1024;
    }

    /**
     * get the elevation-value from original dem-data for a given tile-coordinate
     * @param tileID - the tile to get elevation for
     * @param x - between 0 .. EXTENT
     * @param y - between 0 .. EXTENT
     * @param extent - optional, default 8192
     * @returns the elevation
     */
    getDEMElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        if (!(x >= 0 && x < extent && y >= 0 && y < extent)) return 0;
        const terrain = this.getTerrainData(tileID);
        const dem = terrain.tile?.dem;
        if (!dem)
            return 0;

        const pos = vec2.transformMat4([] as any, [x / extent * EXTENT, y / extent * EXTENT], terrain.u_terrain_matrix);
        const coord = [pos[0] * dem.dim, pos[1] * dem.dim];

        // bilinear interpolation
        const cx = Math.floor(coord[0]),
            cy = Math.floor(coord[1]),
            tx = coord[0] - cx,
            ty = coord[1] - cy;
        return (
            dem.get(cx, cy) * (1 - tx) * (1 - ty) +
            dem.get(cx + 1, cy) * (tx) * (1 - ty) +
            dem.get(cx, cy + 1) * (1 - tx) * (ty) +
            dem.get(cx + 1, cy + 1) * (tx) * (ty)
        );
    }

    /**
     * Get the elevation for given {@link LngLat} in respect of exaggeration.
     * @param lnglat - the location
     * @param zoom - the zoom
     * @returns the elevation
     */
    getElevationForLngLatZoom(lnglat: LngLat, zoom: number) {
        const {tileID, mercatorX, mercatorY} = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return this.getElevation(tileID, mercatorX % EXTENT, mercatorY % EXTENT, EXTENT);
    }

    /**
     * Get the elevation for given coordinate in respect of exaggeration.
     * @param tileID - the tile id
     * @param x - between 0 .. EXTENT
     * @param y - between 0 .. EXTENT
     * @param extent - optional, default 8192
     * @returns the elevation
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        return this.getDEMElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * returns a Terrain Object for a tile. Unless the tile corresponds to data (e.g. tile is loading), return a flat dem object
     * @param tileID - the tile to get the terrain for
     * @returns the terrain data to use in the program
     */
    getTerrainData(tileID: OverscaledTileID): TerrainData {
        // create empty DEM Objects, which will used while raster-dem tiles are loading.
        // creates an empty depth-buffer texture which is needed, during the initialization process of the 3d mesh..
        if (!this._emptyDemTexture) {
            const context = this.painter.context;
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
            const context = this.painter.context;
            sourceTile.demTexture = this.painter.getTileTexture(sourceTile.dem.stride);
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
            'u_terrain_exaggeration': this.exaggeration,
            texture: (sourceTile && sourceTile.demTexture || this._emptyDemTexture).texture,
            depthTexture: (this._fboDepthTexture || this._emptyDepthTexture).texture,
            tile: sourceTile
        };
    }

    /**
     * get a framebuffer as big as the map-div, which will be used to render depth & coords into a texture
     * @param texture - the texture
     * @returns the frame buffer
     */
    getFramebuffer(texture: string): Framebuffer {
        const painter = this.painter;
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
            this._fbo = painter.context.createFramebuffer(width, height, true, false);
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
     * @returns the texture
     */
    getCoordsTexture(): Texture {
        const context = this.painter.context;
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
     * @param p - Screen-Coordinate
     * @returns mercator coordinate for a screen pixel
     */
    pointCoordinate(p: Point): MercatorCoordinate {
        const rgba = new Uint8Array(4);
        const context = this.painter.context, gl = context.gl;
        // grab coordinate pixel from coordinates framebuffer
        context.bindFramebuffer.set(this.getFramebuffer('coords').framebuffer);
        gl.readPixels(p.x, this.painter.height / devicePixelRatio - p.y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        context.bindFramebuffer.set(null);
        // decode coordinates (encoding see getCoordsTexture)
        const x = rgba[0] + ((rgba[2] >> 4) << 8);
        const y = rgba[1] + ((rgba[2] & 15) << 8);
        const tileID = this.coordsIndex[255 - rgba[3]];
        const tile = tileID && this.sourceCache.getTileByID(tileID);
        if (!tile) return null;
        const coordsSize = this._coordsTextureSize;
        const worldSize = (1 << tile.tileID.canonical.z) * coordsSize;
        const mercatorX = (tile.tileID.canonical.x * coordsSize + x) / worldSize;
        return new MercatorCoordinate(
            this._allowMercatorOverflow(p, mercatorX),
            (tile.tileID.canonical.y * coordsSize + y) / worldSize,
            this.getElevation(tile.tileID, x, y, coordsSize)
        );
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @returns the created regular mesh
     */
    getTerrainMesh(): TerrainMesh {
        if (this._mesh) return this._mesh;
        const context = this.painter.context;
        const vertexArray = new Pos3dArray();
        const indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize;
        const delta = EXTENT / meshSize;
        const meshSize2 = meshSize * meshSize;
        for (let y = 0; y <= meshSize; y++) for (let x = 0; x <= meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta, 0);
        for (let y = 0; y < meshSize2; y += meshSize + 1) for (let x = 0; x < meshSize; x++) {
            indexArray.emplaceBack(x + y, meshSize + x + y + 1, meshSize + x + y + 2);
            indexArray.emplaceBack(x + y, meshSize + x + y + 2, x + y + 1);
        }
        // add an extra frame around the mesh to avoid stiching on tile boundaries with different zoomlevels
        // first code-block is for top-bottom frame and second for left-right frame
        const offsetTop = vertexArray.length, offsetBottom = offsetTop + (meshSize + 1) * 2;
        for (const y of [0, 1]) for (let x = 0; x <= meshSize; x++) for (const z of [0, 1])
            vertexArray.emplaceBack(x * delta, y * EXTENT, z);
        for (let x = 0; x < meshSize * 2; x += 2) {
            indexArray.emplaceBack(offsetBottom + x, offsetBottom + x + 1, offsetBottom + x + 3);
            indexArray.emplaceBack(offsetBottom + x, offsetBottom + x + 3, offsetBottom + x + 2);
            indexArray.emplaceBack(offsetTop + x, offsetTop + x + 3, offsetTop + x + 1);
            indexArray.emplaceBack(offsetTop + x, offsetTop + x + 2, offsetTop + x + 3);
        }
        const offsetLeft = vertexArray.length, offsetRight = offsetLeft + (meshSize + 1) * 2;
        for (const x of [0, 1]) for (let y = 0; y <= meshSize; y++) for (const z of [0, 1])
            vertexArray.emplaceBack(x * EXTENT, y * delta, z);
        for (let y = 0; y < meshSize * 2; y += 2) {
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 1, offsetLeft + y + 3);
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 3, offsetLeft + y + 2);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 3, offsetRight + y + 1);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 2, offsetRight + y + 3);
        }
        this._mesh = {
            indexBuffer: context.createIndexBuffer(indexArray),
            vertexBuffer: context.createVertexBuffer(vertexArray, pos3dAttributes.members),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
        return this._mesh;
    }

    /**
     * Calculates a height of the frame around the terrain-mesh to avoid stiching between
     * tile boundaries in different zoomlevels.
     * @param zoom - current zoomlevel
     * @returns the elevation delta in meters
     */
    getMeshFrameDelta(zoom: number): number {
        // divide by 5 is evaluated by trial & error to get a frame in the right height
        return 2 * Math.PI * earthRadius / Math.pow(2, zoom) / 5;
    }

    getMinTileElevationForLngLatZoom(lnglat: LngLat, zoom: number) {
        const {tileID} = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return this.getMinMaxElevation(tileID).minElevation ?? 0;
    }

    /**
     * Get the minimum and maximum elevation contained in a tile. This includes any
     * exaggeration included in the terrain.
     *
     * @param tileID - ID of the tile to be used as a source for the min/max elevation
     * @returns the minimum and maximum elevation found in the tile, including the terrain's
     * exaggeration
     */
    getMinMaxElevation(tileID: OverscaledTileID): {minElevation: number | null; maxElevation: number | null} {
        const tile = this.getTerrainData(tileID).tile;
        const minMax = {minElevation: null, maxElevation: null};
        if (tile && tile.dem) {
            minMax.minElevation = tile.dem.min * this.exaggeration;
            minMax.maxElevation = tile.dem.max * this.exaggeration;
        }
        return minMax;
    }

    _getOverscaledTileIDFromLngLatZoom(lnglat: LngLat, zoom: number): { tileID: OverscaledTileID; mercatorX: number; mercatorY: number} {
        const mercatorCoordinate = MercatorCoordinate.fromLngLat(lnglat.wrap());
        const worldSize = (1 << zoom) * EXTENT;
        const mercatorX = mercatorCoordinate.x * worldSize;
        const mercatorY = mercatorCoordinate.y * worldSize;
        const tileX = Math.floor(mercatorX / EXTENT), tileY = Math.floor(mercatorY / EXTENT);
        const tileID = new OverscaledTileID(zoom, 0, zoom, tileX, tileY);
        return {
            tileID,
            mercatorX,
            mercatorY
        };
    }

    _allowMercatorOverflow(p: Point, mercatorX: number): number {
        const inLeftHalf = p.x < (this.painter.width / 2);
        let lng = lngFromMercatorX(mercatorX);
        const centerLng = this.painter.transform.center.lng;
        if (
            (inLeftHalf && Math.sign(lng) > 0 && Math.sign(centerLng) < 0) ||
            (!inLeftHalf && Math.sign(lng) < 0 && Math.sign(centerLng) > 0)
        ) {
            lng = 360 * Math.sign(centerLng) + lng;
            return mercatorXfromLng(lng);
        }
        return mercatorX;
    }
}
