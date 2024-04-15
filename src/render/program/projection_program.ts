import {Uniform1f, Uniform3f, Uniform4f, UniformLocations, UniformMatrix4f} from '../uniform_binding';
import {Context} from '../../gl/context';
import {mat4, vec3} from 'gl-matrix';

export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
    'u_projection_clipping_plane': Uniform4f;
    'u_projection_transition': Uniform1f;
    'u_projection_fallback_matrix': UniformMatrix4f;
    'u_globe_position': Uniform3f;
    'u_globe_radius': Uniform1f;
    'u_inv_proj_matrix': UniformMatrix4f;
};

export const projectionUniforms = (context: Context, locations: UniformLocations): ProjectionPreludeUniformsType => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords),
    'u_projection_clipping_plane': new Uniform4f(context, locations.u_projection_clipping_plane),
    'u_projection_transition': new Uniform1f(context, locations.u_projection_transition),
    'u_projection_fallback_matrix': new UniformMatrix4f(context, locations.u_projection_fallback_matrix),
    'u_globe_position': new Uniform3f(context, locations.u_globe_position),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
    'u_inv_proj_matrix': new UniformMatrix4f(context, locations.u_inv_proj_matrix),
});

export type ProjectionData = {
    'u_projection_matrix': mat4;
    'u_projection_tile_mercator_coords': [number, number, number, number];
    'u_projection_clipping_plane': [number, number, number, number];
    'u_projection_transition': number;
    'u_projection_fallback_matrix': mat4;
    'u_globe_position': vec3;
    'u_globe_radius': number;
    'u_inv_proj_matrix': mat4;
}
