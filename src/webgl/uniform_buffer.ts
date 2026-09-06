import type {Context} from './context.ts';

export const UBO_BINDINGS = {
    ProjectionUBO: 0,
    TerrainUBO: 1,
    FrameUBO: 2,
};

export function applyUBOBindings(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    for (const [name, binding] of Object.entries(UBO_BINDINGS)) {
        const index = gl.getUniformBlockIndex(program, name);
        if (index !== gl.INVALID_INDEX) {
            gl.uniformBlockBinding(program, index, binding);
        }
    }
}

export type Std140Member = {name: string; type: 'float' | 'int' | 'vec2' | 'vec4' | 'mat4'};
export type Std140Layout = {offsets: Record<string, number>; contentWords: number; sizeWords: number};

const STD140_SIZE_AND_ALIGNMENT_WORDS = {float: [1, 1], int: [1, 1], vec2: [2, 2], vec4: [4, 4], mat4: [16, 4]};

export function std140Layout(members: readonly Std140Member[]): Std140Layout {
    const offsets: Record<string, number> = {};
    let words = 0;
    for (const {name, type} of members) {
        const [size, alignment] = STD140_SIZE_AND_ALIGNMENT_WORDS[type];
        words = Math.ceil(words / alignment) * alignment;
        offsets[name] = words;
        words += size;
    }
    return {offsets, contentWords: words, sizeWords: Math.ceil(words / 4) * 4};
}

/**
 * @internal
 * The buffer behind one std140 uniform block, bound to a fixed binding point. Callers write members into
 * `pending` at the layout's offsets and call `upload`, which skips the GPU write when nothing changed.
 */
export class UniformBuffer {
    context: Context;
    buffer: WebGLBuffer;
    binding: number;
    contentWords: number;
    uploaded: Float32Array;
    pending: Float32Array;
    uploadedWords: Uint32Array;
    pendingWords: Uint32Array;
    hasData: boolean;
    bindingDirty: boolean;

    constructor(context: Context, binding: number, layout: Std140Layout) {
        this.context = context;
        this.binding = binding;
        this.contentWords = layout.contentWords;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, layout.sizeWords * 4, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, binding, this.buffer);
        this.uploaded = new Float32Array(layout.sizeWords);
        this.pending = new Float32Array(layout.sizeWords);
        this.uploadedWords = new Uint32Array(this.uploaded.buffer);
        this.pendingWords = new Uint32Array(this.pending.buffer);
        this.hasData = false;
        this.bindingDirty = false;
    }

    upload(): void {
        const gl = this.context.gl;
        let changed = !this.hasData;
        if (!changed) {
            const words = this.pendingWords;
            const uploadedWords = this.uploadedWords;
            for (let i = 0; i < this.contentWords; i++) {
                if (words[i] !== uploadedWords[i]) {
                    changed = true;
                    break;
                }
            }
        }

        if (this.bindingDirty) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, this.binding, this.buffer);
            this.bindingDirty = false;
        }

        if (!changed) return;

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.pending);
        this.uploaded.set(this.pending);
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
