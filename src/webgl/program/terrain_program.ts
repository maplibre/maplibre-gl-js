import {
    Uniform1i,
    Uniform1f,
    Uniform4f,
    UniformMatrix4f,
    UniformColor
} from '../uniform_binding.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {calculateFogBlendOpacity} from '../../style/sky.ts';

import type {SkyPropsPossiblyEvaluated} from '../../style/sky_properties.g.ts';
import type {mat4} from 'gl-matrix';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Context} from '../../webgl/context.ts';

export type TerrainPreludeUniformsType = {
    'u_depth': Uniform1i;
    'u_terrain': Uniform1i;
};

export type TerrainUniformsType = {
    'u_texture': Uniform1i;
    'u_ele_delta': Uniform1f;
    'u_fog_matrix': UniformMatrix4f;
    'u_fog_color': UniformColor;
    'u_fog_ground_blend': Uniform1f;
    'u_fog_ground_blend_opacity': Uniform1f;
    'u_horizon_color': UniformColor;
    'u_horizon_fog_blend': Uniform1f;
    'u_is_globe_mode': Uniform1f;
};

export type TerrainDepthUniformsType = {
    'u_ele_delta': Uniform1f;
};

export type TerrainHeightUniformsType = {
    'u_tile_bounds': Uniform4f;
};

const terrainPreludeUniforms = (context: Context, locations: UniformLocations): TerrainPreludeUniformsType => ({
    'u_depth': new Uniform1i(context, locations.u_depth),
    'u_terrain': new Uniform1i(context, locations.u_terrain)
});

const terrainUniforms = (context: Context, locations: UniformLocations): TerrainUniformsType => ({
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta),
    'u_fog_matrix': new UniformMatrix4f(context, locations.u_fog_matrix),
    'u_fog_color': new UniformColor(context, locations.u_fog_color),
    'u_fog_ground_blend': new Uniform1f(context, locations.u_fog_ground_blend),
    'u_fog_ground_blend_opacity': new Uniform1f(context, locations.u_fog_ground_blend_opacity),
    'u_horizon_color': new UniformColor(context, locations.u_horizon_color),
    'u_horizon_fog_blend': new Uniform1f(context, locations.u_horizon_fog_blend),
    'u_is_globe_mode': new Uniform1f(context, locations.u_is_globe_mode)
});

const terrainDepthUniforms = (context: Context, locations: UniformLocations): TerrainDepthUniformsType => ({
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});

const terrainHeightUniforms = (context: Context, locations: UniformLocations): TerrainHeightUniformsType => ({
    'u_tile_bounds': new Uniform4f(context, locations.u_tile_bounds)
});

const terrainUniformValues = (
    eleDelta: number,
    fogMatrix: mat4,
    sky: Readonly<SkyPropsPossiblyEvaluated> | undefined,
    pitch: number,
    isGlobeMode: boolean): UniformValues<TerrainUniformsType> => ({
    'u_texture': 0,
    'u_ele_delta': eleDelta,
    'u_fog_matrix': fogMatrix,
    'u_fog_color': sky ? sky['fog-color'] : Color.white,
    'u_fog_ground_blend': sky ? sky['fog-ground-blend'] : 1,
    // Set opacity to 0 when in globe mode to disable fog
    'u_fog_ground_blend_opacity': isGlobeMode ? 0 : (sky ? calculateFogBlendOpacity(pitch) : 0),
    'u_horizon_color': sky ? sky['horizon-color'] : Color.white,
    'u_horizon_fog_blend': sky ? sky['horizon-fog-blend'] : 1,
    'u_is_globe_mode': isGlobeMode ? 1 : 0
});

const terrainDepthUniformValues = (
    eleDelta: number
): UniformValues<TerrainDepthUniformsType> => ({
    'u_ele_delta': eleDelta
});

/**
 * @param tileBounds - the tile's west and north edge and its width and height, as fractions of the height map
 */
const terrainHeightUniformValues = (
    tileBounds: [number, number, number, number]
): UniformValues<TerrainHeightUniformsType> => ({
    'u_tile_bounds': tileBounds
});

export {terrainUniforms, terrainDepthUniforms, terrainHeightUniforms, terrainPreludeUniforms, terrainUniformValues, terrainDepthUniformValues, terrainHeightUniformValues};
