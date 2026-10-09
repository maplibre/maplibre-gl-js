import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RGBAImage} from '../util/image.ts';
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
import {TerrainCoverage, type TerrainCoverageIndex} from './terrain_coverage.ts';

import type {Tile} from '../tile/tile.ts';
import type {Framebuffer} from '../webgl/framebuffer.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Painter} from './painter.ts';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';

/**
 * @experimental
 * A float texture for {@link CustomRenderMethodInput.renderTerrainHeightMap}, such as `RGBA32F`, which needs the
 * `EXT_color_buffer_float` extension to be drawn into. Red holds the elevation in meters, including the terrain exaggeration, alpha
 * is 1 where terrain is loaded and 0 elsewhere, and the first row is the south edge.
 */
export type TerrainHeightMapTarget = {
    /** A texture in the map's WebGL context. */
    texture: WebGLTexture;
    /** The width of the texture in pixels. */
    width: number;
    /** The height of the texture in pixels. */
    height: number;
    /** The area to draw, `[minX, minY, maxX, maxY]` in {@link MercatorCoordinate} units, with x counting world copies. */
    bounds: [number, number, number, number];
};

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
    _heightMapFbo: Framebuffer;
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
    /** The drawn tiles' DEM data as sampled on the CPU, see {@link TerrainCoverage}. */
    coverage: TerrainCoverage;
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
        this.coverage = new TerrainCoverage(this.tileManager, this.exaggeration);
    }

    destroy(): void {
        if (this._fbo) {
            this._fbo.destroy();
            this._fbo = null;
        }
        if (this._heightMapFbo) {
            this._heightMapFbo.destroy();
            this._heightMapFbo = null;
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

        const sampler = this.coverage.getSampler(normalized.tileID);
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
        const elevation = this.getDrawnElevationForLngLat(lnglat);
        if (elevation !== undefined) return elevation;
        return this.getElevationForLngLatZoom(lnglat, this._getFallbackZoom(transform));
    }

    /**
     * Get the elevation of the terrain as drawn at the given {@link LngLat}, in respect of exaggeration, where a drawn
     * tile has DEM data there: its own, or with `ownDemOnly` false a loaded parent's drawn in its place, which can be
     * a few hundred meters off until the tile's own loads.
     * @param lnglat - the location
     * @param ownDemOnly - whether only a drawn tile's own DEM data counts
     * @returns the elevation, or undefined where no drawn tile has that DEM data
     */
    getDrawnElevationForLngLat(lnglat: LngLat, ownDemOnly: boolean = false): number | undefined {
        return this.coverage.sample(lnglat, ownDemOnly);
    }

    /**
     * {@link getElevationForLngLat}, or undefined where it gives 0 for want of DEM data, see
     * {@link hasElevationForLngLat}. Any other elevation comes from DEM data, so only a 0 is checked.
     * @param lnglat - the location
     * @param transform - the transform {@link getElevationForLngLat} is given
     * @returns the elevation, or undefined while no DEM data covers the location
     */
    getLoadedElevationForLngLat(lnglat: LngLat, transform: IReadonlyTransform): number | undefined {
        const elevation = this.getElevationForLngLat(lnglat, transform);
        return elevation !== 0 || this.hasElevationForLngLat(lnglat, transform) ? elevation : undefined;
    }

    /**
     * Whether {@link getElevationForLngLat} finds DEM data at the given {@link LngLat}, drawn or in the tile it falls
     * back to, rather than giving 0 for want of any.
     * @param lnglat - the location
     * @param transform - the transform {@link getElevationForLngLat} is given
     * @returns true where a drawn tile or the fallback tile has DEM data, its own or a loaded parent's
     */
    hasElevationForLngLat(lnglat: LngLat, transform: IReadonlyTransform): boolean {
        if (this.getDrawnElevationForLngLat(lnglat) !== undefined) return true;
        const zoom = this._getFallbackZoom(transform);
        if (!isInBoundsForZoomLngLat(zoom, lnglat.wrap())) return false;
        const {tileID} = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return !!this.tileManager.getSourceTile(tileID, true)?.dem;
    }

    /**
     * The zoom {@link getElevationForLngLat} passes to {@link getElevationForLngLatZoom} where no drawn tile has DEM
     * data: the transform's tile zoom, where the terrain's tiles are loaded.
     */
    private _getFallbackZoom(transform: IReadonlyTransform): number {
        return Math.min(transform.tileZoom, this.tileManager.maxzoom);
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
     * Clear the CPU samplers of the drawn tiles' DEM data, which may retain a previously selected DEM tile.
     * @internal
     */
    resetElevationCache(): void {
        this.coverage.reset();
    }

    /**
     * Index of the tiles the terrain currently renders, for sampling the terrain surface on the CPU.
     * @returns the index, or null when no terrain tile is renderable
     */
    getCoverageIndex(): TerrainCoverageIndex | null {
        return this.coverage.getIndex();
    }

    /**
     * Get the matrix that maps a tile's coordinates into the DEM tile it is rendered with.
     * The transform is derived from the loaded DEM tile's own zoom level, not from the source's
     * declared maxzoom: getSourceTile falls back to a loaded parent tile while the deepest DEM
     * tile is still loading, and the scale and offset must match the tile that is actually used.
     * @param tileID - the tile id
     * @param sourceTile - the DEM tile that is used for this tile, either its own tile or a loaded parent
     * @returns the matrix that maps the tile's coordinates onto the DEM tile
     */
    _getDEMTileMatrix(tileID: OverscaledTileID, sourceTile: Tile): mat4 {
        const matrixKey = `${sourceTile.tileID.key}/${tileID.key}`;
        const cachedMatrix = this._demMatrixCache.get(matrixKey);
        if (cachedMatrix) return cachedMatrix;

        const dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
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
     * get the framebuffer that draws the height map into a texture of a custom layer
     * @param texture - the texture to draw into
     * @returns the frame buffer
     */
    getHeightMapFramebuffer(texture: WebGLTexture): Framebuffer {
        this._heightMapFbo ||= this.painter.context.createFramebuffer(1, 1, false, false);
        this._heightMapFbo.colorAttachment.set(texture);
        return this._heightMapFbo;
    }

    /**
     * create a regular mesh which will be used by all terrain-tiles
     * @param globeEnabled - whether the globe is rendering, which adds the pole geometry of the edge tiles
     * @returns the created regular mesh
     */
    getTerrainMesh(tileId: OverscaledTileID, globeEnabled: boolean): Mesh {
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

