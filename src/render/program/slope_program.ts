import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f
} from '../uniform_binding';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {SlopeStyleLayer} from '../../style/style_layer/slope_style_layer';
import type {DEMData} from '../../data/dem_data';
import type {OverscaledTileID} from '../../tile/tile_id';
import {MercatorCoordinate} from '../../geo/mercator_coordinate';

export type SlopeUniformsType = {
    'u_image': Uniform1i;
    'u_unpack': Uniform4f;
    'u_dimension': Uniform2f;
    'u_zoom': Uniform1f;
    'u_slope_stops': Uniform1i;
    'u_color_stops': Uniform1i;
    'u_color_ramp_size': Uniform1i;
    'u_opacity': Uniform1f;
    'u_latrange': Uniform2f;
};

const slopeUniforms = (context: Context, locations: UniformLocations): SlopeUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_unpack': new Uniform4f(context, locations.u_unpack),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_zoom': new Uniform1f(context, locations.u_zoom),
    'u_slope_stops': new Uniform1i(context, locations.u_slope_stops),
    'u_color_stops': new Uniform1i(context, locations.u_color_stops),
    'u_color_ramp_size': new Uniform1i(context, locations.u_color_ramp_size),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_latrange': new Uniform2f(context, locations.u_latrange)
});

function getTileLatRange(tileID: OverscaledTileID): [number, number] {
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const y = tileID.canonical.y;
    return [
        new MercatorCoordinate(0, y / tilesAtZoom).toLngLat().lat,
        new MercatorCoordinate(0, (y + 1) / tilesAtZoom).toLngLat().lat
    ];
}

const slopeUniformValues = (
    layer: SlopeStyleLayer,
    dem: DEMData,
    colorRampSize: number,
    tileID: OverscaledTileID,
    zoom: number
): UniformValues<SlopeUniformsType> => {
    return {
        'u_image': 0,
        'u_unpack': dem.getUnpackVector(),
        'u_dimension': [dem.stride, dem.stride],
        'u_zoom': zoom,
        'u_slope_stops': 1,
        'u_color_stops': 4,
        'u_color_ramp_size': colorRampSize,
        'u_opacity': layer.paint.get('slope-opacity'),
        'u_latrange': getTileLatRange(tileID)
    };
};

export {
    slopeUniforms,
    slopeUniformValues,
};
