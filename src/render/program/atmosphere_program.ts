import type {Context} from '../../gl/context';
import {UniformValues, UniformLocations, Uniform1f, Uniform3f} from '../uniform_binding';
import {vec3} from 'gl-matrix';

export type atmosphereUniformsType = {
    'u_sun_pos': Uniform3f;
    'u_coefficient': Uniform1f;
};

const atmosphereUniforms = (context: Context, locations: UniformLocations): atmosphereUniformsType => ({
    'u_sun_pos': new Uniform3f(context, locations.u_sun_pos),
    'u_coefficient': new Uniform1f(context, locations.u_coefficient),
});

const atmosphereUniformValues = (
    sunPos: vec3,
    coefficient: number
): UniformValues<atmosphereUniformsType> => ({
    'u_sun_pos': sunPos,
    'u_coefficient': coefficient,
});

export {atmosphereUniforms, atmosphereUniformValues};
