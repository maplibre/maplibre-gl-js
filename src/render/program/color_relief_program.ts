import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f,
    UniformFloatArray,
    UniformColorArray
} from '../uniform_binding';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {ColorReliefStyleLayer} from '../../style/style_layer/color_relief_style_layer';
import type {DEMData} from '../../data/dem_data';

export type ColorReliefUniformsType = {
    'u_image': Uniform1i;
    'u_unpack': Uniform4f;
    'u_dimension': Uniform2f;
    'u_elevation_stops': UniformFloatArray;
    'u_color_stops': UniformColorArray;
    'u_opacity': Uniform1f;
};

const colorReliefUniforms = (context: Context, locations: UniformLocations): ColorReliefUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_unpack': new Uniform4f(context, locations.u_unpack),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_elevation_stops': new UniformFloatArray(context, locations.u_elevation_stops),
    'u_color_stops': new UniformColorArray(context, locations.u_color_stops),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const colorReliefUniformValues = (
    layer: ColorReliefStyleLayer,
    dem: DEMData,
    maxLength: number
): UniformValues<ColorReliefUniformsType> => {

    const colorRamp = layer.getColorRamp(maxLength);
    return {
        'u_image': 0,
        'u_unpack': dem.getUnpackVector(),
        'u_dimension': [dem.stride, dem.stride],
        'u_elevation_stops': colorRamp.elevationStops,
        'u_color_stops': colorRamp.colorStops,
        'u_opacity': layer.paint.get('color-relief-opacity')
    };
};

export {
    colorReliefUniforms,
    colorReliefUniformValues,
};
