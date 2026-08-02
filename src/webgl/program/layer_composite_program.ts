import {Uniform1i, Uniform1f, Uniform2f} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type LayerCompositeUniformsType = {
    'u_image': Uniform1i;
    'u_backdrop': Uniform1i;
    'u_backdrop_offset': Uniform2f;
    'u_opacity': Uniform1f;
};

export const layerCompositeUniforms = (context: Context, locations: UniformLocations): LayerCompositeUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_backdrop': new Uniform1i(context, locations.u_backdrop),
    'u_backdrop_offset': new Uniform2f(context, locations.u_backdrop_offset),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

export const layerCompositeUniformValues = (
    opacity: number,
    textureUnit: number,
    backdropTextureUnit: number,
    backdropOffset: [number, number]
): UniformValues<LayerCompositeUniformsType> => ({
    'u_image': textureUnit,
    'u_backdrop': backdropTextureUnit,
    'u_backdrop_offset': backdropOffset,
    'u_opacity': opacity
});
