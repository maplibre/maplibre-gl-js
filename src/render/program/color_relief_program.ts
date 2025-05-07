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
    'u_colormap': Uniform1i;
    'u_colormap_scale': Uniform1f;
    'u_elevation_start': Uniform1f;
    'u_dimension': Uniform2f;
    'u_elevation_stops': UniformFloatArray;
    'u_color_stops': UniformColorArray;
    'u_colormap_length': Uniform1i;
};

const colorReliefUniforms = (context: Context, locations: UniformLocations): ColorReliefUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_unpack': new Uniform4f(context, locations.u_unpack),
    'u_colormap': new Uniform1i(context, locations.u_colormap),
    'u_colormap_scale': new Uniform1f(context, locations.u_colormap_scale),
    'u_elevation_start': new Uniform1f(context, locations.u_elevation_start),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_elevation_stops': new UniformFloatArray(context, locations.u_elevation_stops),
    'u_color_stops': new UniformColorArray(context, locations.u_color_stops),
    'u_colormap_length': new Uniform1i(context, locations.u_colormap_length)
});

const colorReliefUniformValues = (
    layer: ColorReliefStyleLayer,
    dem: DEMData,
    elevationRange: {start: number; end: number}
): UniformValues<ColorReliefUniformsType> => {

    return {
        'u_image': 0,
        'u_unpack': dem.getUnpackVector(),
        'u_colormap': 5,
        'u_colormap_scale': 1.0 / (elevationRange.end - elevationRange.start),
        'u_elevation_start': elevationRange.start,
        'u_dimension': [dem.stride, dem.stride],
        'u_elevation_stops': layer.elevationStops,
        'u_color_stops': layer.colorStops,
        'u_colormap_length': layer.elevationStops.length
    };
};

export {
    colorReliefUniforms,
    colorReliefUniformValues,
};
