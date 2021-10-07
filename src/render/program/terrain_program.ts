import {
   Uniform1i,
   Uniform1f,
   Uniform4f,
   UniformMatrix4f
} from '../uniform_binding';
import type Context from '../../gl/context';
import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../../render/uniform_binding';
import {mat4} from 'gl-matrix';
import { GlyphOffsetArray } from '../../data/array_types';

export type TerrainUniformsType = {
   'u_matrix': UniformMatrix4f;
   'u_texture': Uniform1i;
   'u_terrain': Uniform1i;
   'u_terrain_matrix': UniformMatrix4f;
   'u_terrain_unpack': Uniform4f;
   'u_terrain_offset': Uniform1f;
   'u_terrain_exaggeration': Uniform1f;
};

export type TerrainDepthUniformsType = {
   'u_matrix': UniformMatrix4f;
   'u_terrain': Uniform1i;
   'u_terrain_matrix': UniformMatrix4f;
   'u_terrain_unpack': Uniform4f;
   'u_terrain_offset': Uniform1f;
   'u_terrain_exaggeration': Uniform1f;
};

export type TerrainCoordsUniformsType = {
   'u_matrix': UniformMatrix4f;
   'u_texture': Uniform1i;
   'u_terrain': Uniform1i;
   'u_terrain_matrix': UniformMatrix4f;
   'u_terrain_unpack': Uniform4f;
   'u_terrain_offset': Uniform1f;
   'u_terrain_coords_id': Uniform1f;
   'u_terrain_exaggeration': Uniform1f;
};

const terrainUniforms = (context: Context, locations: UniformLocations): TerrainUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_texture': new Uniform1i(context, locations.u_texture),
   'u_terrain': new Uniform1i(context, locations.u_terrain),
   'u_terrain_matrix': new UniformMatrix4f(context, locations.u_terrain_matrix),
   'u_terrain_unpack': new Uniform4f(context, locations.u_terrain_unpack),
   'u_terrain_offset': new Uniform1f(context, locations.u_terrain_offset),
   'u_terrain_exaggeration': new Uniform1f(context, locations.u_terrain_exaggeration)
});

const terrainDepthUniforms = (context: Context, locations: UniformLocations): TerrainDepthUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_terrain': new Uniform1i(context, locations.u_terrain),
   'u_terrain_matrix': new UniformMatrix4f(context, locations.u_terrain_matrix),
   'u_terrain_unpack': new Uniform4f(context, locations.u_terrain_unpack),
   'u_terrain_offset': new Uniform1f(context, locations.u_terrain_offset),
   'u_terrain_exaggeration': new Uniform1f(context, locations.u_terrain_exaggeration)
});

const terrainCoordsUniforms = (context: Context, locations: UniformLocations): TerrainCoordsUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_texture': new Uniform1i(context, locations.u_texture),
   'u_terrain': new Uniform1i(context, locations.u_terrain),
   'u_terrain_matrix': new UniformMatrix4f(context, locations.u_terrain_matrix),
   'u_terrain_unpack': new Uniform4f(context, locations.u_terrain_unpack),
   'u_terrain_offset': new Uniform1f(context, locations.u_terrain_offset),
   'u_terrain_coords_id': new Uniform1f(context, locations.u_terrain_coords_id),
   'u_terrain_exaggeration': new Uniform1f(context, locations.u_terrain_exaggeration)
});

const terrainUniformValues = (
   painter: Painter,
   matrix: mat4,
   terrainMatrix: mat4,
   unpackVector: Array<number>,
   offset: number
): UniformValues<TerrainUniformsType> => ({
   'u_matrix': matrix,
   'u_terrain': 0,
   'u_terrain_matrix': terrainMatrix,
   'u_terrain_unpack': unpackVector,
   'u_terrain_offset': offset,
   'u_terrain_exaggeration': painter.style.terrainSourceCache.exaggeration,
   'u_texture': 1
});

const terrainDepthUniformValues = (
   painter: Painter,
   matrix: mat4,
   terrainMatrix: mat4,
   unpackVector: Array<number>,
   offset: number
): UniformValues<TerrainDepthUniformsType> => ({
   'u_matrix': matrix,
   'u_terrain': 0,
   'u_terrain_matrix': terrainMatrix,
   'u_terrain_unpack': unpackVector,
   'u_terrain_offset': offset,
   'u_terrain_exaggeration': painter.style.terrainSourceCache.exaggeration
});

const terrainCoordsUniformValues = (
   painter: Painter,
   matrix: mat4,
   terrainMatrix: mat4,
   coordsId: number,
   unpackVector: Array<number>,
   offset: number
): UniformValues<TerrainCoordsUniformsType> => ({
   'u_matrix': matrix,
   'u_terrain': 0,
   'u_terrain_matrix': terrainMatrix,
   'u_terrain_unpack': unpackVector,
   'u_terrain_offset': offset,
   'u_terrain_coords_id': coordsId / 255,
   'u_terrain_exaggeration': painter.style.terrainSourceCache.exaggeration,
   'u_texture': 1
});

export {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms, terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues};
