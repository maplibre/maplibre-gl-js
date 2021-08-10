// @flow

import {
   Uniform1i,
   Uniform1f,
   UniformMatrix4f
} from '../uniform_binding';
import type Context from '../gl/context';
import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../render/uniform_binding';

export type TerrainUniformsType = {|
   'u_matrix': UniformMatrix4f,
   'u_texture': Uniform1i,
   'u_ele_exaggeration': Uniform1f
|};

export type TerrainCoordsUniformsType = {|
   'u_matrix': UniformMatrix4f,
   'u_texture': Uniform1i,
   'u_terrain_coords_id': Uniform1f,
   'u_ele_exaggeration': Uniform1f
|};

const terrainUniforms = (context: Context, locations: UniformLocations): TerrainUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_texture': new Uniform1i(context, locations.u_texture),
   'u_ele_exaggeration': new Uniform1f(context, locations.u_ele_exaggeration)
});

const terrainCoordsUniforms = (context: Context, locations: UniformLocations): TerrainCoordsUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_texture': new Uniform1i(context, locations.u_texture),
   'u_terrain_coords_id': new Uniform1f(context, locations.u_terrain_coords_id),
   'u_ele_exaggeration': new Uniform1f(context, locations.u_ele_exaggeration)
});

const terrainUniformValues = (painter: Painter, matrix: Float32Array): UniformValues<TerrainUniformsType> => ({
   'u_matrix': matrix,
   'u_texture': 0,
   'u_ele_exaggeration': painter.style.terrainSourceCache.exaggeration
});

const terrainCoordsUniformValues = (painter: Painter, matrix: Float32Array, coordsId: number): UniformValues<TerrainCoordsUniformsType> => ({
   'u_matrix': matrix,
   'u_texture': 0,
   'u_terrain_coords_id': coordsId / 255,
   'u_ele_exaggeration': painter.style.terrainSourceCache.exaggeration
});

export {terrainUniforms, terrainCoordsUniforms, terrainUniformValues, terrainCoordsUniformValues};
