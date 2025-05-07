import type {mat4} from 'gl-matrix';
import type {OverscaledTileID} from '../../source/tile_id';

/**
 * This type contains all data necessary to project a tile to screen in MapLibre's shader system.
 * Contains data used for both mercator and globe projection.
 */
export type ProjectionData = {
    /**
     * The main projection matrix. For mercator projection, it usually projects in-tile coordinates 0..EXTENT to screen,
     * for globe projection, it projects a unit sphere planet to screen.
     * Uniform name: `u_projection_matrix`.
     */
    mainMatrix: mat4;
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
    fallbackMatrix: mat4;
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
