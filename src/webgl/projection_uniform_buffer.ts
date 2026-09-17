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

const UNUSED_FRAMES_BEFORE_EVICTION = 60;

function createProjectionUniformBuffer(context: Context): UniformBuffer {
    return new UniformBuffer(context, UBO_BINDINGS.ProjectionUBO, layout);
}

function writeProjectionData(buffer: UniformBuffer, projectionData: ProjectionData): void {
    const f32 = buffer.pending;
    f32.set(projectionData.mainMatrix, offsets.u_projection_matrix);
    f32.set(projectionData.fallbackMatrix, offsets.u_projection_fallback_matrix);
    f32.set(projectionData.tileMercatorCoords, offsets.u_projection_tile_mercator_coords);
    f32.set(projectionData.clippingPlane, offsets.u_projection_clipping_plane);
    f32[offsets.u_projection_transition] = projectionData.projectionTransition;
    buffer.pendingWords[offsets.u_projection_clip_antimeridian] = projectionData.clipAntimeridian ? 1 : 0;
}

type PooledBuffer = {buffer: UniformBuffer; frame: number};

/**
 * @internal
 * Backs the `ProjectionUBO` block with one buffer per distinct projection setup, keyed by
 * {@link ProjectionData.uniformBufferKey}. A setup is shared by every layer drawn over the same tile, so a frame
 * uploads each one once and rebinds it for the rest of the draws instead of rewriting one buffer per draw call.
 * Projection data without a key gets a buffer that is rewritten on every use.
 */
export class ProjectionUniformBufferPool {
    context: Context;
    private _buffers: Map<string, PooledBuffer>;
    private _unkeyed: UniformBuffer;
    private _frame: number;

    constructor(context: Context) {
        this.context = context;
        this._buffers = new Map();
        this._unkeyed = createProjectionUniformBuffer(context);
        this._frame = 0;
    }

    beginFrame(): void {
        this._frame++;
        for (const [key, pooled] of this._buffers) {
            if (this._frame - pooled.frame < UNUSED_FRAMES_BEFORE_EVICTION) continue;
            pooled.buffer.destroy();
            this._buffers.delete(key);
        }
    }

    use(projectionData: ProjectionData & {uniformBufferKey?: string}): void {
        const key = projectionData.uniformBufferKey;
        if (key === undefined) {
            writeProjectionData(this._unkeyed, projectionData);
            this._unkeyed.uploadUnconditionally();
            return;
        }

        let pooled = this._buffers.get(key);
        if (!pooled) {
            pooled = {buffer: createProjectionUniformBuffer(this.context), frame: -1};
            this._buffers.set(key, pooled);
        }

        if (pooled.frame === this._frame) {
            pooled.buffer.bindNow();
        } else {
            pooled.frame = this._frame;
            writeProjectionData(pooled.buffer, projectionData);
            pooled.buffer.uploadUnconditionally();
        }
    }

    destroy(): void {
        this._unkeyed.destroy();
        for (const pooled of this._buffers.values()) {
            pooled.buffer.destroy();
        }
        this._buffers.clear();
    }
}
