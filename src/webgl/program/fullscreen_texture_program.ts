import {Uniform1i} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type FullscreenTextureUniformsType = {
    'u_image': Uniform1i;
};

const fullscreenTextureUniforms = (context: Context, locations: UniformLocations): FullscreenTextureUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
});

const fullscreenTextureUniformValues = (
    textureUnit: number,
): UniformValues<FullscreenTextureUniformsType> => ({
    'u_image': textureUnit,
});

export {
    fullscreenTextureUniforms,
    fullscreenTextureUniformValues
};
