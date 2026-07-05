import type {mat4} from 'gl-matrix';
import type {OverscaledTileID} from '../../tile/tile_id.ts';
import type {Mat4f32, Mat4f64} from '../../util/util.ts';

export type ProjectionMatrix = Mat4f32 | Mat4f64;

/**
 * Projection data used by renderer shader uniforms. Renderer matrices are stored
 * as 32-bit floats so WebGL can consume them directly without per-upload copies.
 */
export type RendererProjectionData = ProjectionData<Mat4f32>;

/**
 * Projection data exposed to custom layers. Some matrices are stored as 64-bit
 * floats so custom layer code can apply additional CPU-side transforms before
 * converting to 32-bit floats for WebGL upload when necessary.
 */
export type CustomLayerProjectionData = ProjectionData<ProjectionMatrix, ProjectionMatrix>;

/**
 * This type contains all data necessary to project a tile to screen in MapLibre's shader system.
 * Contains data used for both mercator and globe projection.
 */
export type ProjectionData<MainMatrix extends mat4 = mat4, FallbackMatrix extends mat4 = MainMatrix> = {
    /**
     * The main projection matrix. For mercator projection, it usually projects in-tile coordinates 0..EXTENT to screen,
     * for globe projection, it projects a unit sphere planet to screen.
     * Uniform name: `u_projection_matrix`.
     */
    mainMatrix: MainMatrix;
    /**
     * The extent of current tile in the mercator square.
     * Used by globe projection.
     * First two components are X and Y offset, last two are X and Y scale.
     * Uniform name: `u_projection_tile_mercator_coords`.
     *
     * Conversion from in-tile coordinates in range 0..EXTENT is done as follows:
     * @example
     * ```
     * vec2 mercator_coords = u_projection_tile_mercator_coords.xy + in_tile.xy * u_projection_tile_mercator_coords.zw;
     * ```
     */
    tileMercatorCoords: [number, number, number, number];
    /**
     * The plane equation for a plane that intersects the planet's horizon.
     * Assumes the planet to be a unit sphere.
     * Used by globe projection for clipping.
     * Uniform name: `u_projection_clipping_plane`.
     */
    clippingPlane: [number, number, number, number];
    /**
     * A value in range 0..1 indicating interpolation between mercator (0) and globe (1) projections.
     * Used by globe projection to hide projection transition at high zooms.
     * Uniform name: `u_projection_transition`.
     */
    projectionTransition: number;
    /**
     * Fallback matrix that projects the current tile according to mercator projection.
     * Used by globe projection to fall back to mercator projection in an animated way.
     * Uniform name: `u_projection_fallback_matrix`.
     */
    fallbackMatrix: FallbackMatrix;
};

/**
 * Parameters object for the transform's `getProjectionData` function.
 * Contains the requested tile ID and more.
 */
export type ProjectionDataParams = {
    /**
     * The ID of the current tile
     */
    overscaledTileID: OverscaledTileID | null;
    /**
     * Set to true if a pixel-aligned matrix should be used, if possible (mostly used for raster tiles under mercator projection)
     */
    aligned?: boolean;
    /**
     * Set to true if the terrain matrix should be applied (i.e. when rendering terrain)
     */
    applyTerrainMatrix?: boolean;
    /**
     * Set to true if the globe matrix should be applied (i.e. when rendering globe)
     */
    applyGlobeMatrix?: boolean;
};
