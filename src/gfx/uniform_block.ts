const TYPE_INFO = {
    float: {align: 4, size: 4, floats: 1},
    vec2: {align: 8, size: 8, floats: 2},
    vec3: {align: 16, size: 12, floats: 3},
    vec4: {align: 16, size: 16, floats: 4},
    mat4: {align: 16, size: 64, floats: 16},
} as const;

export type Std140Type = keyof typeof TYPE_INFO;
export type Std140Field = {name: string; type: Std140Type};

function alignUp(offset: number, alignment: number): number {
    return Math.ceil(offset / alignment) * alignment;
}

type FieldInfo = {offset: number; floats: number};

/**
 * std140-laid-out uniform block with a CPU shadow (`_data`) mirroring the GPU buffer.
 * The buffer may be owned (lazily created on first `upload()`) or pool-supplied
 * via `attachBuffer()` before the first `upload()`.
 */
export class UniformBlock {
    private readonly _gl: WebGL2RenderingContext;
    private readonly _fields: Map<string, FieldInfo>;
    private readonly _data: Float32Array;
    private readonly _byteLength: number;
    private _buffer: WebGLBuffer | null;

    constructor(gl: WebGL2RenderingContext, layout: readonly Std140Field[]) {
        this._gl = gl;
        this._fields = new Map();

        let cursor = 0;
        for (const field of layout) {
            const info = TYPE_INFO[field.type];
            const aligned = alignUp(cursor, info.align);
            this._fields.set(field.name, {offset: aligned, floats: info.floats});
            cursor = aligned + info.size;
        }

        this._byteLength = alignUp(cursor, 16);
        this._data = new Float32Array(this._byteLength / 4);
        this._buffer = null;
    }

    write(name: string, value: number | readonly number[]): void {
        const field = this._fields.get(name);
        if (!field) return;
        const idx = field.offset >> 2;

        if (typeof value === 'number') {
            this._data[idx] = value;
            return;
        }
        for (let i = 0; i < field.floats; i++) {
            this._data[idx + i] = value[i];
        }
    }

    attachBuffer(buffer: WebGLBuffer): void {
        this._buffer = buffer;
    }

    upload(): void {
        const gl = this._gl;
        const firstUpload = !this._buffer;
        if (firstUpload) {
            this._buffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.UNIFORM_BUFFER, this._buffer);
        if (firstUpload) {
            gl.bufferData(gl.UNIFORM_BUFFER, this._data, gl.DYNAMIC_DRAW);
        } else {
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this._data);
        }
    }

    get buffer(): WebGLBuffer | null {
        return this._buffer;
    }

    get data(): Float32Array {
        return this._data;
    }

    get byteLength(): number {
        return this._byteLength;
    }
}
