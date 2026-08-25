import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RGBAImage} from '../util/image.ts';
import {warnOnce} from '../util/util.ts';
import {Pos3dArray, TriangleIndexArray} from '../data/array_types.g.ts';
import pos3dAttributes from '../data/pos3d_attributes.ts';
import {SegmentVector} from '../data/segment.ts';
import {Texture} from '../webgl/texture.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {TerrainTileManager} from '../tile/terrain_tile_manager.ts';
import {EXTENT} from '../data/extent.ts';
import {earthRadius, type LngLat} from '../geo/lng_lat.ts';
import {Mesh} from './mesh.ts';
import {isInBoundsForZoomLngLat} from '../util/world_bounds.ts';
import {NORTH_POLE_Y, SOUTH_POLE_Y} from './subdivision.ts';
import {coveringTiles} from '../geo/projection/covering_tiles.ts';
import type Point from '@mapbox/point-geometry';
import type {Tile} from '../tile/tile.ts';
import type {Framebuffer} from '../webgl/framebuffer.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Painter} from './painter.ts';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';

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
};

export type TerrainElevationSampler = (x: number, y: number, extent: number) => number;

const MAX_BISECTIONS = 40;
const HIT_EPSILON_M = 1e-6;
/** Keeps the elevation bracket non-degenerate when the terrain is entirely flat, such as unloaded DEMs. */
const BRACKET_PADDING_M = 10;
/** `DEMData.sampleBilinear` throws on the far tile edge, so samples stop just short of it. */
const MAX_TILE_COORD = EXTENT * (1 - 1e-12);

export type TerrainSample = {
    covered: boolean;
    /** Whether the elevation comes from loaded DEM data rather than the flat surface rendered while it loads. */
    demLoaded: boolean;
    elevation: number;
};

export type TerrainCoverageIndex = {
    zooms: number[];
    samplerPerTile: Map<string, TerrainElevationSampler | null>;
    minElevation: number;
    maxElevation: number;
};

/**
 * @internal
 * This is the main class which handles most of the 3D Terrain logic. It has the following topics:
 *
 * 1. loads raster-dem tiles via the internal tileManager this.tileManager
 * 2. creates a depth-framebuffer, which is used to calculate the visibility of coordinates
 * 3. stores all render-to-texture tiles in the this.tileManager._tiles
 * 4. calculates the elevation for a specific tile-coordinate
 * 5. creates a terrain-mesh
 *
 * A note about the GPU resource-usage:
 *
 * Framebuffers:
 *
 * - one for the depth framebuffer with the size of the map-div.
 * - one for rendering a tile to texture with the size of tileSize (= 512x512).
 *
 * Textures:
 *
 * - one texture for an empty raster-dem tile with size 1x1
 * - one texture for an empty depth-buffer, when terrain is disabled with size 1x1
 * - one texture for an each loaded raster-dem with size of the source.tileSize
 * - one texture for the depth-framebuffer with the size of the map-div.
 * - finally for each render-to-texture tile (= this._tiles) a set of textures
 * for each render stack (The stack-concept is documented in painter.ts).
 *
 * Normally there exists 1-3 Textures per tile, depending on the stylesheet.
 * Each Textures has the size 2*tileSize (= 1024x1024). Also there exists a
 * cache of the last 150 newest rendered tiles.
 *
 */
export class Terrain {
    /**
     * The style this terrain corresponds to
     */
    painter: Painter;
    /**
     * the tilemanager this terrain is based on
     */
    tileManager: TerrainTileManager;
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
     * holds the framebuffer object in size of the screen to render the depth into a texture.
     */
    _fbo: Framebuffer;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    /**
     * GL Objects for the terrain-mesh
     * The mesh is a regular mesh, which has the advantage that it can be reused for all tiles.
     */
    _meshCache: { [key: string]: Mesh } = {};
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
    _demMatrixCache: Map<string, mat4>;
    /**
     * Cache of resolved CPU elevation samplers. It is cleared when the set of renderable
     * terrain tiles changes and whenever the terrain source changes.
     * Missing DEM data is deliberately not cached so a later sample can retry.
     */
    _elevationSamplerCache: Map<string, TerrainElevationSampler>;
    /**
     * Index of the tiles the terrain draws, used by CPU raycasts and elevation lookups.
     * It is cleared together with the elevation sampler cache; undefined means not built yet.
     */
    _coverageIndex: TerrainCoverageIndex | null | undefined;
    /**
     * Controls how terrain skirt length is calculated.
     * @see {@link MapOptions.terrainSkirtLength}
     */
    _terrainSkirtLength: 'none' | 'auto';
    constructor(painter: Painter, tileManager: TileManager, options: TerrainSpecification, terrainSkirtLength: 'none' | 'auto' = 'auto') {
        this.painter = painter;
        this.tileManager = new TerrainTileManager(tileManager);
        this.options = options;
        this.exaggeration = typeof options.exaggeration === 'number' ? options.exaggeration : 1.0;
        this._terrainSkirtLength = terrainSkirtLength;
        this.qualityFactor = 2;
        this.meshSize = 128;
        this._demMatrixCache = new Map();
        this._elevationSamplerCache = new Map();
    }

    destroy(): void {
        if (this._fbo) {
            this._fbo.destroy();
            this._fbo = null;
        }
        if (this._fboDepthTexture) {
            this._fboDepthTexture.destroy();
            this._fboDepthTexture = null;
        }
        if (this._emptyDemTexture) {
            this._emptyDemTexture.destroy();
            this._emptyDemTexture = null;
        }
        if (this._emptyDepthTexture) {
            this._emptyDepthTexture.destroy();
            this._emptyDepthTexture = null;
        }
        for (const key in this._meshCache) {
            this._meshCache[key].destroy();
        }
        this._meshCache = {};
        this.tileManager.destruct();
    }

    /**
     * Get the elevation-value from original dem-data for a given tile-coordinate.
     * Coordinates that fall outside `[0, extent)` are normalized to the
     * appropriate neighbor tile before lookup.
     * @param tileID - the tile to get the elevation for
     * @param x - x coordinate relative to the tile, may be outside `[0, extent)`
     * @param y - y coordinate relative to the tile, may be outside `[0, extent)`
     * @param extent - optional, default 8192
     * @returns the elevation
     */
    getDEMElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        const normalized = tileID.normalizeCoordinates(x, y, extent);
        if (!normalized) return 0;

        const sampler = this.getElevationSampler(normalized.tileID);
        return sampler ? sampler(normalized.x, normalized.y, extent) : 0;
    }

    /**
     * Get the elevation for given {@link LngLat} in respect of exaggeration.
     * @param lnglat - the location
     * @param zoom - the zoom, use {@link getElevationForLngLat} if you don't want a specific zoom level, but more accurate results.
     * @returns the elevation
     */
    getElevationForLngLatZoom(lnglat: LngLat, zoom: number): number {
        if (!isInBoundsForZoomLngLat(zoom, lnglat.wrap())) return 0;
        const {tileID, mercatorX, mercatorY} = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return this.getElevation(tileID, mercatorX % EXTENT, mercatorY % EXTENT, EXTENT);
    }

    /**
     * Get the elevation for given {@link LngLat} in respect of exaggeration.
     * Where the location is covered by a rendered tile with loaded DEM data this samples the
     * rendered surface, so the result agrees with what is drawn; elsewhere it traverses up the
     * zoom levels to find the first tile with data to return.
     * @param lnglat - the location
     * @returns the elevation
     */
    getElevationForLngLat(lnglat: LngLat, transform: IReadonlyTransform): number {
        const index = this.getCoverageIndex();
        if (index) {
            const mercator = MercatorCoordinate.fromLngLat(lnglat);
            const sample = sampleAt(index, this.exaggeration, mercator.x, mercator.y);
            if (sample.demLoaded) return sample.elevation;
        }
        const terrainCoveringTiles = coveringTiles(transform, {maxzoom: this.tileManager.maxzoom, minzoom: this.tileManager.minzoom, tileSize: 512, terrain: this});
        let zoom = 0;
        for (const tile of terrainCoveringTiles) {
            if (tile.canonical.z > zoom) {
                zoom = Math.min(tile.canonical.z, this.tileManager.maxzoom);
            }
        }
        return this.getElevationForLngLatZoom(lnglat, zoom);
    }

    /**
     * Get the elevation for given coordinate in respect of exaggeration.
     * @param tileID - the tile id
     * @param x - x coordinate relative to the tile, may be outside `[0, extent)`
     * @param y - y coordinate relative to the tile, may be outside `[0, extent)`
     * @param extent - optional, default 8192
     * @returns the elevation
     */
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent: number = EXTENT): number {
        return this.getDEMElevation(tileID, x, y, extent) * this.exaggeration;
    }

    /**
     * Clear CPU elevation samplers that may retain a previously selected DEM tile.
     * @internal
     */
    resetElevationCache(): void {
        this._elevationSamplerCache.clear();
        this._coverageIndex = undefined;
    }

    /**
     * Index of the tiles the terrain currently renders, for sampling the terrain surface on the CPU.
     * Built on first use and kept until {@link resetElevationCache}.
     * @returns the index, or null when no terrain tile is renderable
     */
    getCoverageIndex(): TerrainCoverageIndex | null {
        if (this._coverageIndex === undefined) {
            this._coverageIndex = this._buildCoverageIndex();
        }
        return this._coverageIndex;
    }

    private _buildCoverageIndex(): TerrainCoverageIndex | null {
        const zooms: number[] = [];
        const samplerPerTile = new Map<string, TerrainElevationSampler | null>();
        let minElevation = 0;
        let maxElevation = 0;

        for (const tile of this.tileManager.getRenderableTiles()) {
            if (!tile) continue;
            const {canonical, wrap} = tile.tileID;
            if (!zooms.includes(canonical.z)) zooms.push(canonical.z);
            const sampler = this.getElevationSampler(tile.tileID);
            samplerPerTile.set(`${wrap}/${canonical.z}/${canonical.x}/${canonical.y}`, sampler);
            const {minElevation: tileMin, maxElevation: tileMax} = this.getMinMaxElevation(tile.tileID);
            minElevation = Math.min(minElevation, tileMin ?? 0);
            maxElevation = Math.max(maxElevation, tileMax ?? 0);
        }

        if (samplerPerTile.size === 0) return null;
        zooms.sort((a, b) => b - a);
        return {zooms, samplerPerTile, minElevation: minElevation - BRACKET_PADDING_M, maxElevation: maxElevation + BRACKET_PADDING_M};
    }

    /**
     * Get a function that samples the raw DEM elevation of a tile, without exaggeration.
     * @param tileID - the tile id
     * @returns the sampler, or null when the tile's DEM data is not loaded
     */
    private getElevationSampler(tileID: OverscaledTileID): TerrainElevationSampler | null {
        const key = tileID.key;
        const cachedSampler = this._elevationSamplerCache.get(key);
        if (cachedSampler) return cachedSampler;

        const sourceTile = this.tileManager.getSourceTile(tileID, true);
        const dem = sourceTile?.dem;
        if (!sourceTile || !dem) return null;

        const matrix = this._getDEMTileMatrix(tileID, sourceTile);
        // Store the vector-tile to DEM-pixel transform once for the hot sampling loop.
        const demPixelScaleX = matrix[0] * dem.dim;
        const demPixelScaleY = matrix[5] * dem.dim;
        const demPixelOffsetX = matrix[12] * dem.dim;
        const demPixelOffsetY = matrix[13] * dem.dim;
        const sampler = (x: number, y: number, extent: number): number => {
            const extentScale = extent === EXTENT ? 1 : EXTENT / extent;
            return dem.sampleBilinear(
                x * extentScale * demPixelScaleX + demPixelOffsetX,
                y * extentScale * demPixelScaleY + demPixelOffsetY
            );
        };
        this._elevationSamplerCache.set(key, sampler);
        return sampler;
    }

    _getDEMTileMatrix(tileID: OverscaledTileID, sourceTile: Tile): mat4 {
        const matrixKey = `${sourceTile.tileID.key}/${tileID.key}`;
        const cachedMatrix = this._demMatrixCache.get(matrixKey);
        if (cachedMatrix) return cachedMatrix;

        const maxzoom = this.tileManager.getSource().maxzoom;
        let dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
        if (tileID.overscaledZ > tileID.canonical.z) {
            if (tileID.canonical.z >= maxzoom) dz =  tileID.canonical.z - maxzoom;
            else warnOnce('cannot calculate elevation if elevation maxzoom > source.maxzoom');
        }
        const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
        const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
        const demMatrix = mat4.fromScaling(new Float64Array(16), [1 / (EXTENT << dz), 1 / (EXTENT << dz), 0]);
        mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
        this._demMatrixCache.set(matrixKey, demMatrix);
        return demMatrix;
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
            this._emptyDemMatrix = mat4.identity([]);
        }
        // find covering dem tile and prepare demTexture
        const sourceTile = this.tileManager.getSourceTile(tileID, true);
        if (sourceTile?.dem && (!sourceTile.demTexture || sourceTile.needsTerrainPrepare)) {
            const context = this.painter.context;
            sourceTile.demTexture ||= this.painter.getTileTexture(sourceTile.dem.stride);
            if (sourceTile.demTexture) sourceTile.demTexture.update(sourceTile.dem.getPixels(), {premultiply: false});
            else sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, {premultiply: false});
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            sourceTile.needsTerrainPrepare = false;
        }
        const terrainMatrix = sourceTile ? this._getDEMTileMatrix(tileID, sourceTile) : this._emptyDemMatrix;
        // return uniform values & textures
        return {
            'u_depth': 2,
            'u_terrain': 3,
            'u_terrain_dim': sourceTile?.dem?.dim || 1,
            'u_terrain_matrix': terrainMatrix,
            'u_terrain_unpack': sourceTile?.dem?.getUnpackVector() || this._emptyDemUnpack,
            'u_terrain_exaggeration': this.exaggeration,
            texture: (sourceTile?.demTexture || this._emptyDemTexture).texture,
            depthTexture: (this._fboDepthTexture || this._emptyDepthTexture).texture,
            tile: sourceTile
        };
    }

    /**
     * get a framebuffer as big as the map-div, which will be used to render depth into a texture
     * @returns the frame buffer
     */
    getFramebuffer(): Framebuffer {
        const painter = this.painter;
        const width = painter.width / devicePixelRatio;
        const height = painter.height / devicePixelRatio;
        if (this._fbo && (this._fbo.width !== width || this._fbo.height !== height)) {
            this._fbo.destroy();
            this._fboDepthTexture.destroy();
            delete this._fbo;
            delete this._fboDepthTexture;
        }
        if (!this._fboDepthTexture) {
            this._fboDepthTexture = new Texture(painter.context, {width, height, data: null}, painter.context.gl.RGBA, {premultiply: false});
            this._fboDepthTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fbo) {
            this._fbo = painter.context.createFramebuffer(width, height, true, false);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        this._fbo.colorAttachment.set(this._fboDepthTexture.texture);
        return this._fbo;
    }

    /**
     * Reads the depth value from the depth-framebuffer at a given screen pixel
     * @param p - Screen coordinate
     * @returns depth value in clip space (between 0 and 1)
     */
    depthAtPoint(p: Point): number {
        const rgba = new Uint8Array(4);
        const context = this.painter.context, gl = context.gl;
        context.bindFramebuffer.set(this.getFramebuffer().framebuffer);
        gl.readPixels(p.x, this.painter.height / devicePixelRatio - p.y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        context.bindFramebuffer.set(null);
        // decode the depth value packed by terrain_depth.fragment.glsl
        return (rgba[0] / (256 * 256 * 256) + rgba[1] / (256 * 256) + rgba[2] / 256 + rgba[3]) / 256;
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @returns the created regular mesh
     */
    getTerrainMesh(tileId: OverscaledTileID): Mesh {
        const globeEnabled = this.painter.style.projection?.transitionState > 0;
        const northPole = globeEnabled && tileId.canonical.y === 0;
        const southPole = globeEnabled && tileId.canonical.y === (1 << tileId.canonical.z) - 1;
        const key = `m_${northPole ? 'n' : ''}_${southPole ? 's' : ''}`;
        if (this._meshCache[key]) {
            return this._meshCache[key];
        }
        const context = this.painter.context;

        const vertexArray = new Pos3dArray();
        const indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize;
        const delta = EXTENT / meshSize;
        const meshSize2 = meshSize * meshSize;
        for (let y = 0; y <= meshSize; y++) for (let x = 0; x <= meshSize; x++) {
            vertexArray.emplaceBack(x * delta, y * delta, 0);
        }
        for (let y = 0; y < meshSize2; y += meshSize + 1) for (let x = 0; x < meshSize; x++) {
            indexArray.emplaceBack(x + y, meshSize + x + y + 1, meshSize + x + y + 2);
            indexArray.emplaceBack(x + y, meshSize + x + y + 2, x + y + 1);
        }
        if (this._terrainSkirtLength !== 'none') {
            this._buildSkirts(vertexArray, indexArray, meshSize, delta, northPole, southPole);
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, pos3dAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );
        this._meshCache[key] = mesh;
        return mesh;
    }

    /**
     * Calculates the height of the tile skirts for the "auto" strategy.
     * @see {@link MapOptions.terrainSkirtLength}
     * @param zoom - current zoomlevel
     * @returns the elevation delta in meters
     */
    getSkirtLength(zoom: number): number {
        // divide by 5 is evaluated by trial & error to get a frame in the right height
        return 2 * Math.PI * earthRadius / Math.pow(2, Math.max(zoom, 0)) / 5;
    }

    getMinTileElevationForLngLatZoom(lnglat: LngLat, zoom: number): number {
        if (!isInBoundsForZoomLngLat(zoom, lnglat.wrap())) return 0;
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
        const tile = this.tileManager.getSourceTile(tileID, true);
        const minMax: {minElevation: number | null; maxElevation: number | null} = {minElevation: null, maxElevation: null};
        if (tile?.dem) {
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

    /** Add an extra frame around the mesh to avoid hairline gaps (stitching) on tile boundaries with different zoomlevels.
     * @see {@link MapOptions.terrainSkirtLength}
    */
    _buildSkirts(vertexArray: Pos3dArray, indexArray: TriangleIndexArray, meshSize: number, delta: number, northPole: boolean, southPole: boolean): void {
        const offsetTop = vertexArray.length;
        const offsetTopEdge = 0;
        const offsetBottom = offsetTop + (meshSize + 1);
        const offsetBottomEdge = (meshSize + 1) * meshSize;
        const northY = northPole ? NORTH_POLE_Y : 0;
        const northZ = northPole ? 0 : 1;
        const southY = southPole ? SOUTH_POLE_Y : EXTENT;
        const southZ = southPole ? 0 : 1;
        for (let x = 0; x <= meshSize; x++) {
            vertexArray.emplaceBack(x * delta, northY, northZ);
        }
        for (let x = 0; x <= meshSize; x++) {
            vertexArray.emplaceBack(x * delta, southY, southZ);
        }
        for (let x = 0; x < meshSize; x++) {
            indexArray.emplaceBack(offsetBottomEdge + x, offsetBottom + x, offsetBottom + x + 1);
            indexArray.emplaceBack(offsetBottomEdge + x, offsetBottom + x + 1, offsetBottomEdge + x + 1);
            indexArray.emplaceBack(offsetTopEdge + x, offsetTop + x + 1, offsetTop + x);
            indexArray.emplaceBack(offsetTopEdge + x, offsetTopEdge + x + 1, offsetTop + x + 1);
        }
        // left-right frame
        const offsetLeft = vertexArray.length;
        const offsetRight = offsetLeft + (meshSize + 1) * 2;
        for (const x of [0, 1]) for (let y = 0; y <= meshSize; y++) for (const z of [0, 1]) {
            vertexArray.emplaceBack(x * EXTENT, y * delta, z);
        }
        for (let y = 0; y < meshSize * 2; y += 2) {
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 1, offsetLeft + y + 3);
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 3, offsetLeft + y + 2);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 3, offsetRight + y + 1);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 2, offsetRight + y + 3);
        }
    }
}

const NOT_COVERED: TerrainSample = {covered: false, demLoaded: false, elevation: 0};

/**
 * Elevation of the rendered terrain surface at a mercator position, and whether it is covered at all.
 * A covered tile whose DEM has not loaded yet is flat at zero, which is what the terrain mesh renders.
 */
export function sampleAt(index: TerrainCoverageIndex, exaggeration: number, mercatorX: number, mercatorY: number): TerrainSample {
    if (mercatorY < 0 || mercatorY >= 1) return NOT_COVERED;
    const wrap = Math.floor(mercatorX);
    const wrappedX = mercatorX - wrap;

    for (const z of index.zooms) {
        const scale = 1 << z;
        const scaledX = wrappedX * scale;
        const scaledY = mercatorY * scale;
        const tileX = Math.floor(scaledX);
        const tileY = Math.floor(scaledY);
        const key = `${wrap}/${z}/${tileX}/${tileY}`;
        if (!index.samplerPerTile.has(key)) continue;
        const sampler = index.samplerPerTile.get(key);
        if (!sampler) return {covered: true, demLoaded: false, elevation: 0};
        const x = Math.min((scaledX - tileX) * EXTENT, MAX_TILE_COORD);
        const y = Math.min((scaledY - tileY) * EXTENT, MAX_TILE_COORD);
        return {covered: true, demLoaded: true, elevation: sampler(x, y, EXTENT) * exaggeration};
    }
    return NOT_COVERED;
}

/**
 * Whether a height in meters is at or below the sampled terrain surface.
 * The epsilon absorbs rounding when a bracket endpoint lands exactly on the surface.
 */
export function isBelowTerrainSample(sample: TerrainSample, height: number): boolean {
    return sample.covered && height <= sample.elevation + HIT_EPSILON_M;
}

/**
 * Narrows the bracket `[lo, hi]` around the surface crossing until it is shorter than `tolerance` in ray parameter units.
 */
export function bisect<Ray>(ray: Ray, isBelowTerrain: (ray: Ray, t: number) => boolean, lo: number, hi: number, tolerance: number): {lo: number; hi: number} {
    for (let j = 0; j < MAX_BISECTIONS && hi - lo > tolerance; j++) {
        const mid = (lo + hi) / 2;
        if (isBelowTerrain(ray, mid)) hi = mid;
        else lo = mid;
    }
    return {lo, hi};
}
