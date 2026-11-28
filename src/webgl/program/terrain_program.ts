import {
    Uniform1i,
    Uniform1f,
    Uniform4f
} from '../uniform_binding.ts';

import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Context} from '../../webgl/context.ts';

export type TerrainPreludeUniformsType = {
    'u_depth': Uniform1i;
    'u_terrain': Uniform1i;
};

export type TerrainUniformsType = {
    'u_texture': Uniform1i;
    'u_ele_delta': Uniform1f;
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
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});

const terrainDepthUniforms = (context: Context, locations: UniformLocations): TerrainDepthUniformsType => ({
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta)
});

const terrainHeightUniforms = (context: Context, locations: UniformLocations): TerrainHeightUniformsType => ({
    'u_tile_bounds': new Uniform4f(context, locations.u_tile_bounds)
});

const terrainUniformValues = (
    eleDelta: number
): UniformValues<TerrainUniformsType> => ({
    'u_texture': 0,
    'u_ele_delta': eleDelta
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
