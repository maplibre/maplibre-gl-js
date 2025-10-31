import {mat4} from 'gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';

import type {Context} from '../../gl/context';
import type {Tile} from '../../tile/tile';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {Painter} from '../painter';
import type {HeatmapStyleLayer} from '../../style/style_layer/heatmap_style_layer';
import {EXTENT} from '../../data/extent';

export type HeatmapUniformsType = {
    'u_extrude_scale': Uniform1f;
    'u_intensity': Uniform1f;
    'u_globe_extrude_scale': Uniform1f;
};

export type HeatmapTextureUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_world': Uniform2f;
    'u_image': Uniform1i;
    'u_color_ramp': Uniform1i;
    'u_opacity': Uniform1f;
};

const heatmapUniforms = (context: Context, locations: UniformLocations): HeatmapUniformsType => ({
    'u_extrude_scale': new Uniform1f(context, locations.u_extrude_scale),
    'u_intensity': new Uniform1f(context, locations.u_intensity),
    'u_globe_extrude_scale': new Uniform1f(context, locations.u_globe_extrude_scale)
});

const heatmapTextureUniforms = (context: Context, locations: UniformLocations): HeatmapTextureUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_color_ramp': new Uniform1i(context, locations.u_color_ramp),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const heatmapUniformValues = (tile: Tile, zoom: number, intensity: number, radiusCorrectionFactor: number): UniformValues<HeatmapUniformsType> => {
    const pixelRatio = pixelsToTileUnits(tile, 1, zoom);
    // See comment in circle_program.ts
    const globeExtrudeScale = pixelRatio / (EXTENT * Math.pow(2, tile.tileID.overscaledZ)) * 2.0 * Math.PI * radiusCorrectionFactor;
    return {
        'u_extrude_scale': pixelsToTileUnits(tile, 1, zoom),
        'u_intensity': intensity,
        'u_globe_extrude_scale': globeExtrudeScale
    };
};

const heatmapTextureUniformValues = (
    painter: Painter,
    layer: HeatmapStyleLayer,
    textureUnit: number,
    colorRampUnit: number
): UniformValues<HeatmapTextureUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': textureUnit,
        'u_color_ramp': colorRampUnit,
        'u_opacity': layer.paint.get('heatmap-opacity')
    };
};

export {
    heatmapUniforms,
    heatmapTextureUniforms,
    heatmapUniformValues,
    heatmapTextureUniformValues
};
