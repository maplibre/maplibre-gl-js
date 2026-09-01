import type {Context} from './context.ts';
import type {ProjectionData} from '../geo/projection/projection_data.ts';

export const PROJECTION_UBO_BINDING_POINT = 0;

export const PROJECTION_UBO_MEMBERS = [
    {name: 'u_projection_matrix', type: 'mat4', offset: 0},
    {name: 'u_projection_fallback_matrix', type: 'mat4', offset: 16},
    {name: 'u_projection_tile_mercator_coords', type: 'vec4', offset: 32},
    {name: 'u_projection_clipping_plane', type: 'vec4', offset: 36},
    {name: 'u_projection_transition', type: 'float', offset: 40},
    {name: 'u_projection_clip_antimeridian', type: 'int', offset: 41},
] as const;

const UBO_CONTENT_WORDS = 42;
const PROJECTION_UBO_SIZE_WORDS = Math.ceil(UBO_CONTENT_WORDS / 4) * 4;

const [MATRIX, FALLBACK_MATRIX, TILE_MERCATOR_COORDS, CLIPPING_PLANE, TRANSITION, CLIP_ANTIMERIDIAN] =
    PROJECTION_UBO_MEMBERS.map(m => m.offset);

/**
 * @internal
 * The buffer behind the `ProjectionUBO` block in the shader preludes, written by `Program.draw` before each draw.
 */
export class ProjectionUniformBuffer {
    context: Context;
    buffer: WebGLBuffer;
    uploaded: Float32Array;
    pending: Float32Array;
    uploadedWords: Uint32Array;
    pendingWords: Uint32Array;
    hasData: boolean;
    bindingDirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, PROJECTION_UBO_SIZE_WORDS * 4, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, PROJECTION_UBO_BINDING_POINT, this.buffer);
        this.uploaded = new Float32Array(PROJECTION_UBO_SIZE_WORDS);
        this.pending = new Float32Array(PROJECTION_UBO_SIZE_WORDS);
        this.uploadedWords = new Uint32Array(this.uploaded.buffer);
        this.pendingWords = new Uint32Array(this.pending.buffer);
        this.hasData = false;
        this.bindingDirty = false;
    }

    update(projectionData: ProjectionData): void {
        const gl = this.context.gl;
        const f32 = this.pending;
        const words = this.pendingWords;
        f32.set(projectionData.mainMatrix, MATRIX);
        f32.set(projectionData.fallbackMatrix, FALLBACK_MATRIX);
        f32.set(projectionData.tileMercatorCoords, TILE_MERCATOR_COORDS);
        f32.set(projectionData.clippingPlane, CLIPPING_PLANE);
        f32[TRANSITION] = projectionData.projectionTransition;
        words[CLIP_ANTIMERIDIAN] = projectionData.clipAntimeridian ? 1 : 0;

        let changed = !this.hasData;
        if (!changed) {
            const uploadedWords = this.uploadedWords;
            for (let i = 0; i < UBO_CONTENT_WORDS; i++) {
                if (words[i] !== uploadedWords[i]) {
                    changed = true;
                    break;
                }
            }
        }

        if (this.bindingDirty) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, PROJECTION_UBO_BINDING_POINT, this.buffer);
            this.bindingDirty = false;
        }

        if (!changed) return;

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, f32);
        this.uploaded.set(f32);
        this.hasData = true;
    }

    destroy(): void {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}
