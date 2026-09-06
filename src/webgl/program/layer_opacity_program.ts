import {Uniform1i, Uniform1f} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type LayerOpacityUniformsType = {
    'u_image': Uniform1i;
    'u_opacity': Uniform1f;
};

export const layerOpacityUniforms = (context: Context, locations: UniformLocations): LayerOpacityUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

export const layerOpacityUniformValues = (
    opacity: number,
    textureUnit: number
): UniformValues<LayerOpacityUniformsType> => ({
    'u_image': textureUnit,
    'u_opacity': opacity
});
