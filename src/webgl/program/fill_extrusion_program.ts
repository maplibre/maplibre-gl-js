import {patternUniformValues} from './pattern.ts';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f
} from '../uniform_binding.ts';
import {mat3, vec3} from 'gl-matrix';
import {sphericalToCartesian} from '../../util/util.ts';
import {getCameraMath} from '../../camera/camera_math_factory.ts';
import {EXTENT} from '../../data/extent.ts';
import {latFromMercatorY, mercatorZfromAltitude} from '../../geo/mercator_coordinate.ts';

import type {Context} from '../../webgl/context.ts';
import type {CanonicalTileID, OverscaledTileID} from '../../tile/tile_id.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.ts';
import type {Tile} from '../../tile/tile.ts';
import type {LightPropsPossiblyEvaluated} from '../../style/light_properties.g.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';

export type FillExtrusionUniformsType = {
    'u_lightpos': Uniform3f;
    'u_lightpos_globe': Uniform3f;
    'u_lightintensity': Uniform1f;
    'u_lightcolor': Uniform3f;
    'u_lightambient': Uniform3f;
    'u_vertical_gradient': Uniform1f;
    'u_fill_translate': Uniform2f;
    'u_ao_wall_intensity': Uniform1f;
    'u_ao_wall_radius': Uniform1f;
};

export type FillExtrusionPatternUniformsType = {
    'u_lightpos': Uniform3f;
    'u_lightpos_globe': Uniform3f;
    'u_lightintensity': Uniform1f;
    'u_lightcolor': Uniform3f;
    'u_lightambient': Uniform3f;
    'u_height_factor': Uniform1f;
    'u_vertical_gradient': Uniform1f;
    'u_fill_translate': Uniform2f;
    'u_ao_wall_intensity': Uniform1f;
    'u_ao_wall_radius': Uniform1f;
    // pattern uniforms:
    'u_texsize': Uniform2f;
    'u_image': Uniform1i;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
};

export type FillExtrusionGroundOcclusionUniformsType = {
    'u_ao_ground_intensity': Uniform1f;
    'u_ao_ground_radius': Uniform1f;
    'u_ao_ground_tuck': Uniform1f;
    'u_tile_units_per_meter': Uniform1f;
    'u_fill_translate': Uniform2f;
    'u_inv_size': Uniform2f;
};

const fillExtrusionUniforms = (context: Context, locations: UniformLocations): FillExtrusionUniformsType => ({
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightpos_globe': new Uniform3f(context, locations.u_lightpos_globe),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_lightambient': new Uniform3f(context, locations.u_lightambient),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_ao_wall_intensity': new Uniform1f(context, locations.u_ao_wall_intensity),
    'u_ao_wall_radius': new Uniform1f(context, locations.u_ao_wall_radius),
});

const fillExtrusionPatternUniforms = (context: Context, locations: UniformLocations): FillExtrusionPatternUniformsType => ({
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightpos_globe': new Uniform3f(context, locations.u_lightpos_globe),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_lightambient': new Uniform3f(context, locations.u_lightambient),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_height_factor': new Uniform1f(context, locations.u_height_factor),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_ao_wall_intensity': new Uniform1f(context, locations.u_ao_wall_intensity),
    'u_ao_wall_radius': new Uniform1f(context, locations.u_ao_wall_radius),
    // pattern uniforms
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)
});

const fillExtrusionGroundOcclusionUniforms = (context: Context, locations: UniformLocations): FillExtrusionGroundOcclusionUniformsType => ({
    'u_ao_ground_intensity': new Uniform1f(context, locations.u_ao_ground_intensity),
    'u_ao_ground_radius': new Uniform1f(context, locations.u_ao_ground_radius),
    'u_ao_ground_tuck': new Uniform1f(context, locations.u_ao_ground_tuck),
    'u_tile_units_per_meter': new Uniform1f(context, locations.u_tile_units_per_meter),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_inv_size': new Uniform2f(context, locations.u_inv_size),
});

const fillExtrusionUniformValues = (
    projectedCamera: ProjectedCamera,
    light: Readonly<LightPropsPossiblyEvaluated>,
    shouldUseVerticalGradient: boolean,
    translate: [number, number],
    aoWallIntensity: number,
    aoWallRadius: number,
): UniformValues<FillExtrusionUniformsType> => {
    const lightPos = sphericalToCartesian(light.position);
    const lightMat = mat3.create();
    if (light.anchor === 'viewport') {
        mat3.fromRotation(lightMat, projectedCamera.bearingInRadians);
    }
    vec3.transformMat3(lightPos, lightPos, lightMat);
    const transformedLightPos = getCameraMath(projectedCamera).transformLightDirection(projectedCamera, lightPos);

    const lightColor = light.color;
    const ambientColor = light['ambient-color'];
    const ambientIntensity = light['ambient-intensity'];

    return {
        'u_lightpos': lightPos,
        'u_lightpos_globe': transformedLightPos,
        'u_lightintensity': light.intensity,
        'u_lightcolor': [lightColor.r, lightColor.g, lightColor.b],
        'u_lightambient': [
            ambientColor.r * ambientIntensity,
            ambientColor.g * ambientIntensity,
            ambientColor.b * ambientIntensity,
        ],
        'u_vertical_gradient': +shouldUseVerticalGradient,
        'u_fill_translate': translate,
        'u_ao_wall_intensity': aoWallIntensity,
        'u_ao_wall_radius': aoWallRadius,
    };
};

const fillExtrusionPatternUniformValues = (
    projectedCamera: ProjectedCamera,
    light: Readonly<LightPropsPossiblyEvaluated>,
    shouldUseVerticalGradient: boolean,
    translate: [number, number],
    aoWallIntensity: number,
    aoWallRadius: number,
    coord: OverscaledTileID,
    crossfade: CrossfadeParameters,
    tile: Tile
): UniformValues<FillExtrusionPatternUniformsType> => {
    return {
        ...fillExtrusionUniformValues(projectedCamera, light, shouldUseVerticalGradient, translate, aoWallIntensity, aoWallRadius),
        ...patternUniformValues(crossfade, projectedCamera, tile),
        'u_height_factor': -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8
    };
};

const ZERO_VEC2: [number, number] = [0, 0];

const fillExtrusionGroundOcclusionUniformValues = (
    intensity: number,
    radius: number,
    tuck: number,
    translate: [number, number],
    canonical: CanonicalTileID
): UniformValues<FillExtrusionGroundOcclusionUniformsType> => {
    const tileCount = Math.pow(2, canonical.z);
    const latitude = latFromMercatorY((canonical.y + 0.5) / tileCount);

    return {
        'u_ao_ground_intensity': intensity,
        'u_ao_ground_radius': radius,
        'u_ao_ground_tuck': tuck,
        'u_tile_units_per_meter': mercatorZfromAltitude(1, latitude) * EXTENT * tileCount,
        'u_fill_translate': translate,
        'u_inv_size': ZERO_VEC2,
    };
};

const fillExtrusionGroundOcclusionCompositeUniformValues = (
    invWidth: number,
    invHeight: number
): UniformValues<FillExtrusionGroundOcclusionUniformsType> => ({
    'u_ao_ground_intensity': 0,
    'u_ao_ground_radius': 0,
    'u_ao_ground_tuck': 0,
    'u_tile_units_per_meter': 0,
    'u_fill_translate': ZERO_VEC2,
    'u_inv_size': [invWidth, invHeight],
});

export {
    fillExtrusionUniforms,
    fillExtrusionPatternUniforms,
    fillExtrusionGroundOcclusionUniforms,
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionGroundOcclusionUniformValues,
    fillExtrusionGroundOcclusionCompositeUniformValues
};
