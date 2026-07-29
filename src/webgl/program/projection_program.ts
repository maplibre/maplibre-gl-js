import {Uniform1f, Uniform1i, Uniform4f, type UniformLocations, type UniformValues, UniformMatrix4f} from '../uniform_binding.ts';
import {type Context} from '../../webgl/context.ts';

import type {ProjectionData} from '../../geo/projection/projection_data.ts';

export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
    'u_projection_clipping_plane': Uniform4f;
    'u_projection_transition': Uniform1f;
    'u_projection_fallback_matrix': UniformMatrix4f;
    'u_projection_clip_antimeridian': Uniform1i;
};

export const projectionUniforms = (context: Context, locations: UniformLocations): ProjectionPreludeUniformsType => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords),
    'u_projection_clipping_plane': new Uniform4f(context, locations.u_projection_clipping_plane),
    'u_projection_transition': new Uniform1f(context, locations.u_projection_transition),
    'u_projection_fallback_matrix': new UniformMatrix4f(context, locations.u_projection_fallback_matrix),
    'u_projection_clip_antimeridian': new Uniform1i(context, locations.u_projection_clip_antimeridian),
});

/**
 * Converts a {@link ProjectionData} object into the values expected by the projection prelude's uniforms.
 */
export const projectionUniformValues = (projectionData: ProjectionData): UniformValues<ProjectionPreludeUniformsType> => ({
    'u_projection_matrix': projectionData.mainMatrix,
    'u_projection_tile_mercator_coords': projectionData.tileMercatorCoords,
    'u_projection_clipping_plane': projectionData.clippingPlane,
    'u_projection_transition': projectionData.projectionTransition,
    'u_projection_fallback_matrix': projectionData.fallbackMatrix,
    'u_projection_clip_antimeridian': projectionData.clipAntimeridian ? 1 : 0,
});
