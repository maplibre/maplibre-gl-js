import {Uniform1f, Uniform4f, type UniformLocations, UniformMatrix4f} from '../uniform_binding';
import {type Context} from '../../gl/context';
// This next import is needed for the "@link" in the documentation to work properly.

import type {ProjectionData} from '../../geo/projection/projection_data';

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

/**
 * Maps a field name in {@link ProjectionData} to its corresponding uniform name in {@link ProjectionPreludeUniformsType}.
 */
export const projectionObjectToUniformMap: {[field in keyof ProjectionData]: keyof ProjectionPreludeUniformsType} = {
    mainMatrix: 'u_projection_matrix',
    tileMercatorCoords: 'u_projection_tile_mercator_coords',
    clippingPlane: 'u_projection_clipping_plane',
    projectionTransition: 'u_projection_transition',
    fallbackMatrix: 'u_projection_fallback_matrix',
};
