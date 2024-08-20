import {Uniform1f, Uniform4f, UniformLocations, UniformMatrix4f} from '../uniform_binding';
import {Context} from '../../gl/context';
import {mat4} from 'gl-matrix';

export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
    'u_projection_clipping_plane': Uniform4f;
    'u_projection_transition': Uniform1f;
    'u_projection_fallback_matrix': UniformMatrix4f;
};

export const projectionUniforms = (context: Context, locations: UniformLocations): ProjectionPreludeUniformsType => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords),
    'u_projection_clipping_plane': new Uniform4f(context, locations.u_projection_clipping_plane),
    'u_projection_transition': new Uniform1f(context, locations.u_projection_transition),
    'u_projection_fallback_matrix': new UniformMatrix4f(context, locations.u_projection_fallback_matrix),
});

export type ProjectionData = {
    /**
     * The main projection matrix. For mercator projection, it usually projects in-tile coordinates 0..EXTENT to screen,
     * for globe projection, it projects a unit sphere planet to screen.
     */
    'u_projection_matrix': mat4;
    /**
     * The extent of current tile in the mercator square.
     * Used by globe projection.
     * First two components are X and Y offset, last two are X and Y scale.
     * Conversion from in-tile coordinates in range 0..EXTENT is done as follows:
     * ```
     * vec2 mercator_coords = u_projection_tile_mercator_coords.xy + in_tile.xy * u_projection_tile_mercator_coords.zw;
     * ```
     */
    'u_projection_tile_mercator_coords': [number, number, number, number];
    /**
     * The plane equation for a plane that intersects the planet's horizon.
     * Assumes the planet to be a unit sphere.
     * Used by globe projection for clipping.
     */
    'u_projection_clipping_plane': [number, number, number, number];
    /**
     * A value in range 0..1 indicating interpolation between mercator (0) and globe (1) projections.
     * Used by globe projection to hide projection transition at high zooms.
     */
    'u_projection_transition': number;
    /**
     * Fallback matrix that projects the current tile according to mercator projection.
     * Used by globe projection to fall back to mercator projection in an animated way.
     */
    'u_projection_fallback_matrix': mat4;
}
