import type {Context} from '../../gl/context';
import {type UniformValues, type UniformLocations, Uniform1f, Uniform3f, UniformMatrix4f} from '../uniform_binding';
import {type mat4, type vec3} from 'gl-matrix';

export type atmosphereUniformsType = {
    'u_sun_pos': Uniform3f;
    'u_atmosphere_blend': Uniform1f;
    'u_globe_position': Uniform3f;
    'u_globe_radius': Uniform1f;
    'u_inv_proj_matrix': UniformMatrix4f;
};

const atmosphereUniforms = (context: Context, locations: UniformLocations): atmosphereUniformsType => ({
    'u_sun_pos': new Uniform3f(context, locations.u_sun_pos),
    'u_atmosphere_blend': new Uniform1f(context, locations.u_atmosphere_blend),
    'u_globe_position': new Uniform3f(context, locations.u_globe_position),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
    'u_inv_proj_matrix': new UniformMatrix4f(context, locations.u_inv_proj_matrix),
});

const atmosphereUniformValues = (
    sunPos: vec3,
    atmosphereBlend: number,
    globePosition: vec3,
    globeRadius: number,
    invProjMatrix: mat4,
): UniformValues<atmosphereUniformsType> => ({
    'u_sun_pos': sunPos,
    'u_atmosphere_blend': atmosphereBlend,
    'u_globe_position': globePosition,
    'u_globe_radius': globeRadius,
    'u_inv_proj_matrix': invProjMatrix,
});

export {atmosphereUniforms, atmosphereUniformValues};
