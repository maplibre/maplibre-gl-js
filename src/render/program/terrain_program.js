// @flow

import {
   Uniform1i,
   UniformMatrix4f
} from '../uniform_binding';
import type Context from '../gl/context';
import type {UniformValues, UniformLocations} from '../render/uniform_binding';

export type TerrainUniformsType = {|
   'u_matrix': UniformMatrix4f,
   'u_texture': Uniform1i
|};

const terrainUniforms = (context: Context, locations: UniformLocations): TerrainRasterUniformsType => ({
   'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
   'u_texture': new Uniform1i(context, locations.u_texture)
});

const terrainUniformValues = (matrix: Float32Array): UniformValues<TerrainRasterUniformsType> => ({
   'u_matrix': matrix,
   'u_texture': 0
});

export {terrainUniforms, terrainUniformValues};
