import {UBO_BINDINGS, UniformBuffer, std140Layout} from './uniform_buffer.ts';
import type {Context} from './context.ts';
import type {ProjectionData} from '../geo/projection/projection_data.ts';

const layout = std140Layout([
    {name: 'u_projection_matrix', type: 'mat4'},
    {name: 'u_projection_fallback_matrix', type: 'mat4'},
    {name: 'u_projection_tile_mercator_coords', type: 'vec4'},
    {name: 'u_projection_clipping_plane', type: 'vec4'},
    {name: 'u_projection_transition', type: 'float'},
    {name: 'u_projection_clip_antimeridian', type: 'int'},
]);

const offsets = layout.offsets;

/**
 * @internal
 * The buffer behind the `ProjectionUBO` block in the shader preludes, written by `Program.draw` before each draw.
 */
export function createProjectionUniformBuffer(context: Context): UniformBuffer {
    return new UniformBuffer(context, UBO_BINDINGS.ProjectionUBO, layout);
}

export function updateProjectionUniformBuffer(buffer: UniformBuffer, projectionData: ProjectionData): void {
    const f32 = buffer.pending;
    f32.set(projectionData.mainMatrix, offsets.u_projection_matrix);
    f32.set(projectionData.fallbackMatrix, offsets.u_projection_fallback_matrix);
    f32.set(projectionData.tileMercatorCoords, offsets.u_projection_tile_mercator_coords);
    f32.set(projectionData.clippingPlane, offsets.u_projection_clipping_plane);
    f32[offsets.u_projection_transition] = projectionData.projectionTransition;
    buffer.pendingWords[offsets.u_projection_clip_antimeridian] = projectionData.clipAntimeridian ? 1 : 0;
    buffer.upload();
}
