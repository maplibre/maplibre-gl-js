import {Uniform1i, Uniform1f, Uniform2f} from '../uniform_binding';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {Tile} from '../../tile/tile';
import type {CircleStyleLayer} from '../../style/style_layer/circle_style_layer';
import type {Painter} from '../painter';
import {EXTENT} from '../../data/extent';

export type CircleUniformsType = {
    'u_camera_to_center_distance': Uniform1f;
    'u_scale_with_map': Uniform1i;
    'u_pitch_with_map': Uniform1i;
    'u_extrude_scale': Uniform2f;
    'u_device_pixel_ratio': Uniform1f;
    'u_globe_extrude_scale': Uniform1f;
    'u_translate': Uniform2f;
};

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_scale_with_map': new Uniform1i(context, locations.u_scale_with_map),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_globe_extrude_scale': new Uniform1f(context, locations.u_globe_extrude_scale),
    'u_translate': new Uniform2f(context, locations.u_translate),
});

const circleUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: CircleStyleLayer,
    translate: [number, number],
    radiusCorrectionFactor: number
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;

    let pitchWithMap: boolean, extrudeScale: [number, number];
    let globeExtrudeScale: number = 0;
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
        pitchWithMap = true;
        extrudeScale = [pixelRatio, pixelRatio];

        // For globe rendering we need to know how much to extrude the circle as an *angle*.
        // The calculation: (one pixel in tile units) / (earth circumference in tile units) * (2PI radians) * radiusCorrectionFactor
        globeExtrudeScale = pixelRatio / (EXTENT * Math.pow(2, tile.tileID.overscaledZ)) * 2.0 * Math.PI * radiusCorrectionFactor;
    } else {
        pitchWithMap = false;
        extrudeScale = transform.pixelsToGLUnits;
    }

    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_scale_with_map': +(layer.paint.get('circle-pitch-scale') === 'map'),
        'u_pitch_with_map': +(pitchWithMap),
        'u_device_pixel_ratio': painter.pixelRatio,
        'u_extrude_scale': extrudeScale,
        'u_globe_extrude_scale': globeExtrudeScale,
        'u_translate': translate,
    };
};

export {circleUniforms, circleUniformValues};
