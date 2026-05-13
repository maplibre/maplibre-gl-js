import {Uniform1i} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type TranslucentCacheUniformsType = {
    'u_image': Uniform1i;
};

const translucentCacheUniforms = (context: Context, locations: UniformLocations): TranslucentCacheUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
});

const translucentCacheUniformValues = (
    textureUnit: number,
): UniformValues<TranslucentCacheUniformsType> => ({
    'u_image': textureUnit,
});

export {
    translucentCacheUniforms,
    translucentCacheUniformValues
};
