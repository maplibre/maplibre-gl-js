import {patternUniformValues} from './pattern.ts';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
} from '../uniform_binding.ts';

import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Context} from '../../webgl/context.ts';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.ts';
import type {Tile} from '../../tile/tile.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';

export type FillUniformsType = {
    'u_fill_translate': Uniform2f;
    'u_rounded_corner_distance': Uniform1f;
};

export type FillOutlineUniformsType = {
    'u_fill_translate': Uniform2f;
    'u_rounded_corner_distance': Uniform1f;
};

export type FillPatternUniformsType = {
    // pattern uniforms:
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_sdf_pattern': Uniform1i;
    'u_fill_translate': Uniform2f;
    'u_rounded_corner_distance': Uniform1f;
};

export type FillOutlinePatternUniformsType = {
    // pattern uniforms:
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_sdf_pattern': Uniform1i;
    'u_fill_translate': Uniform2f;
    'u_rounded_corner_distance': Uniform1f;
};

const fillUniforms = (context: Context, locations: UniformLocations): FillUniformsType => ({
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_rounded_corner_distance': new Uniform1f(context, locations.u_rounded_corner_distance)
});

const fillPatternUniforms = (context: Context, locations: UniformLocations): FillPatternUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    'u_sdf_pattern': new Uniform1i(context, locations.u_sdf_pattern),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_rounded_corner_distance': new Uniform1f(context, locations.u_rounded_corner_distance)
});

const fillOutlineUniforms = (context: Context, locations: UniformLocations): FillOutlineUniformsType => ({
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_rounded_corner_distance': new Uniform1f(context, locations.u_rounded_corner_distance)
});

const fillOutlinePatternUniforms = (context: Context, locations: UniformLocations): FillOutlinePatternUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    'u_sdf_pattern': new Uniform1i(context, locations.u_sdf_pattern),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_rounded_corner_distance': new Uniform1f(context, locations.u_rounded_corner_distance)
});

/**
 * Returns the uniform values of the `fillPattern` program.
 * @param roundedCornerDistance - `fill-rounded-corner-distance`, already converted to the tile's units
 */
const fillPatternUniformValues = (
    projectedCamera: ProjectedCamera,
    crossfade: CrossfadeParameters,
    tile: Tile,
    translate: [number, number],
    isSdfPattern: boolean,
    roundedCornerDistance: number
): UniformValues<FillPatternUniformsType> => ({
    ...patternUniformValues(crossfade, projectedCamera, tile),
    'u_fill_translate': translate,
    'u_sdf_pattern': isSdfPattern ? 1 : 0,
    'u_rounded_corner_distance': roundedCornerDistance,
});

/**
 * Returns the uniform values of the `fill` program.
 * @param roundedCornerDistance - `fill-rounded-corner-distance`, already converted to the tile's units
 */
const fillUniformValues = (translate: [number, number], roundedCornerDistance: number): UniformValues<FillUniformsType> => ({
    'u_fill_translate': translate,
    'u_rounded_corner_distance': roundedCornerDistance,
});

/**
 * Returns the uniform values of the `fillOutline` program.
 * @param roundedCornerDistance - `fill-rounded-corner-distance`, already converted to the tile's units
 */
const fillOutlineUniformValues = (translate: [number, number], roundedCornerDistance: number): UniformValues<FillOutlineUniformsType> => ({
    'u_fill_translate': translate,
    'u_rounded_corner_distance': roundedCornerDistance,
});

/**
 * Returns the uniform values of the `fillOutlinePattern` program.
 * @param roundedCornerDistance - `fill-rounded-corner-distance`, already converted to the tile's units
 */
const fillOutlinePatternUniformValues = (
    projectedCamera: ProjectedCamera,
    crossfade: CrossfadeParameters,
    tile: Tile,
    translate: [number, number],
    isSdfPattern: boolean,
    roundedCornerDistance: number
): UniformValues<FillOutlinePatternUniformsType> => fillPatternUniformValues(projectedCamera, crossfade, tile, translate, isSdfPattern, roundedCornerDistance);

export {
    fillUniforms,
    fillPatternUniforms,
    fillOutlineUniforms,
    fillOutlinePatternUniforms,
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
};
