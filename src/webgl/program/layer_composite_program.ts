import {Uniform1i, Uniform1f} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type LayerCompositeUniformsType = {
    'u_image': Uniform1i;
    'u_backdrop': Uniform1i;
    'u_opacity': Uniform1f;
};

export const layerCompositeUniforms = (context: Context, locations: UniformLocations): LayerCompositeUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_backdrop': new Uniform1i(context, locations.u_backdrop),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

export const layerCompositeUniformValues = (
    opacity: number,
    textureUnit: number,
    backdropTextureUnit: number
): UniformValues<LayerCompositeUniformsType> => ({
    'u_image': textureUnit,
    'u_backdrop': backdropTextureUnit,
    'u_opacity': opacity
});
