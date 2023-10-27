import {
    Uniform1i,
    Uniform4f,
    UniformMatrix4f
} from '../uniform_binding';
import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../../render/uniform_binding';
import {mat4, vec4} from 'gl-matrix';

export type GlobeUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_texture': Uniform1i;
    'u_color_debug': Uniform4f;
};

const globeUniforms = (context: Context, locations: UniformLocations): GlobeUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_color_debug': new Uniform4f(context, locations.u_color_debug),
});

const globeUniformValues = (
    matrix: mat4,
    colorDebug: vec4,
): UniformValues<GlobeUniformsType> => ({
    'u_matrix': matrix,
    'u_texture': 0,
    'u_color_debug': colorDebug,
});

export {globeUniforms, globeUniformValues};
