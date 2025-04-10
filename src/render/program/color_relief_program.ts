import {
    Uniform1i,
    Uniform4f
} from '../uniform_binding';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {ColorReliefStyleLayer} from '../../style/style_layer/color_relief_style_layer';
import type {DEMData} from '../../data/dem_data';

export type ColorReliefUniformsType = {
    'u_image': Uniform1i;
    'u_unpack': Uniform4f;
};

const colorReliefUniforms = (context: Context, locations: UniformLocations): ColorReliefUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_unpack': new Uniform4f(context, locations.u_unpack)
});

const colorReliefUniformValues = (
    layer: ColorReliefStyleLayer,
    dem: DEMData
): UniformValues<ColorReliefUniformsType> => {

    return {
        'u_image': 0,
        'u_unpack': dem.getUnpackVector()
    };
};

export {
    colorReliefUniforms,
    colorReliefUniformValues,
};
