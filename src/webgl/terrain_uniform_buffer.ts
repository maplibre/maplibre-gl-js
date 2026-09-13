import {UBO_BINDINGS, UniformBuffer, std140Layout} from './uniform_buffer.ts';
import type {Context} from './context.ts';
import type {TerrainData} from '../render/terrain.ts';

const layout = std140Layout([
    {name: 'u_terrain_matrix', type: 'mat4'},
    {name: 'u_terrain_unpack', type: 'vec4'},
    {name: 'u_terrain_dim', type: 'float'},
    {name: 'u_terrain_exaggeration', type: 'float'},
]);

const offsets = layout.offsets;

/**
 * @internal
 * The buffer behind the `TerrainUBO` block in the vertex prelude, written by `Program.draw` for every draw with terrain.
 */
export function createTerrainUniformBuffer(context: Context): UniformBuffer {
    return new UniformBuffer(context, UBO_BINDINGS.TerrainUBO, layout);
}

export function updateTerrainUniformBuffer(buffer: UniformBuffer, terrain: TerrainData): void {
    const f32 = buffer.pending;
    f32.set(terrain.u_terrain_matrix, offsets.u_terrain_matrix);
    f32.set(terrain.u_terrain_unpack, offsets.u_terrain_unpack);
    f32[offsets.u_terrain_dim] = terrain.u_terrain_dim;
    f32[offsets.u_terrain_exaggeration] = terrain.u_terrain_exaggeration;
    buffer.upload();
}
