import {
    Uniform1i,
    Uniform1f,
    Uniform4f,
    UniformMatrix4f,
    UniformColor
} from '../uniform_binding';
import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../../render/uniform_binding';
import {type Sky} from '../../style/sky';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {type mat4} from 'gl-matrix';

export type TerrainPreludeUniformsType = {
    'u_depth': Uniform1i;
    'u_terrain': Uniform1i;
    'u_terrain_dim': Uniform1f;
    'u_terrain_matrix': UniformMatrix4f;
    'u_terrain_unpack': Uniform4f;
    'u_terrain_exaggeration': Uniform1f;
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

export type TerrainCoordsUniformsType = {
    'u_texture': Uniform1i;
    'u_terrain_coords_id': Uniform1f;
    'u_ele_delta': Uniform1f;
};

const terrainPreludeUniforms = (context: Context, locations: UniformLocations): TerrainPreludeUniformsType => ({
    'u_depth': new Uniform1i(context, locations.u_depth),
    'u_terrain': new Uniform1i(context, locations.u_terrain),
    'u_terrain_dim': new Uniform1f(context, locations.u_terrain_dim),
    'u_terrain_matrix': new UniformMatrix4f(context, locations.u_terrain_matrix),
    'u_terrain_unpack': new Uniform4f(context, locations.u_terrain_unpack),
    'u_terrain_exaggeration': new Uniform1f(context, locations.u_terrain_exaggeration)
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

const terrainCoordsUniforms = (context: Context, locations: UniformLocations): TerrainCoordsUniformsType => ({
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_terrain_coords_id': new Uniform1f(context, locations.u_terrain_coords_id),
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});

const terrainUniformValues = (
    eleDelta: number,
    fogMatrix: mat4,
    sky: Sky,
    pitch: number,
    isGlobeMode: boolean): UniformValues<TerrainUniformsType> => ({
    'u_texture': 0,
    'u_ele_delta': eleDelta,
    'u_fog_matrix': fogMatrix,
    'u_fog_color': sky ? sky.properties.get('fog-color') : Color.white,
    'u_fog_ground_blend': sky ? sky.properties.get('fog-ground-blend') : 1,
    // Set opacity to 0 when in globe mode to disable fog
    'u_fog_ground_blend_opacity': isGlobeMode ? 0 : (sky ? sky.calculateFogBlendOpacity(pitch) : 0),
    'u_horizon_color': sky ? sky.properties.get('horizon-color') : Color.white,
    'u_horizon_fog_blend': sky ? sky.properties.get('horizon-fog-blend') : 1,
    'u_is_globe_mode': isGlobeMode ? 1 : 0
});

const terrainDepthUniformValues = (
    eleDelta: number
): UniformValues<TerrainDepthUniformsType> => ({
    'u_ele_delta': eleDelta
});

const terrainCoordsUniformValues = (
    coordsId: number,
    eleDelta: number
): UniformValues<TerrainCoordsUniformsType> => ({
    'u_terrain_coords_id': coordsId / 255,
    'u_texture': 0,
    'u_ele_delta': eleDelta
});

export {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms, terrainPreludeUniforms, terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues};
