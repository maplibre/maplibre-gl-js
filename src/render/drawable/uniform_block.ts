import type {Device, Buffer as LumaBuffer} from '@luma.gl/core';

/**
 * Typed buffer wrapper for GPU uniform blocks.
 * Provides typed views (f32, i32, u32) over a shared ArrayBuffer,
 * with dirty tracking and GPU buffer management.
 */
export class UniformBlock {
    _data: ArrayBuffer;
    _f32: Float32Array;
    _i32: Int32Array;
    _u32: Uint32Array;
    _gpuBuffer: LumaBuffer | null;
    _dirty: boolean;
    _byteLength: number;

    constructor(byteLength: number) {
        // Ensure 16-byte alignment (required by WebGPU)
        this._byteLength = Math.ceil(byteLength / 16) * 16;
        this._data = new ArrayBuffer(this._byteLength);
        this._f32 = new Float32Array(this._data);
        this._i32 = new Int32Array(this._data);
        this._u32 = new Uint32Array(this._data);
        this._gpuBuffer = null;
        this._dirty = true;
    }

    setFloat(byteOffset: number, value: number): void {
        this._f32[byteOffset >> 2] = value;
        this._dirty = true;
    }

    setVec2(byteOffset: number, x: number, y: number): void {
        const idx = byteOffset >> 2;
        this._f32[idx] = x;
        this._f32[idx + 1] = y;
        this._dirty = true;
    }

    setVec4(byteOffset: number, x: number, y: number, z: number, w: number): void {
        const idx = byteOffset >> 2;
        this._f32[idx] = x;
        this._f32[idx + 1] = y;
        this._f32[idx + 2] = z;
        this._f32[idx + 3] = w;
        this._dirty = true;
    }

    setMat4(byteOffset: number, matrix: Float32Array | Float64Array): void {
        const idx = byteOffset >> 2;
        for (let i = 0; i < 16; i++) {
            this._f32[idx + i] = matrix[i];
        }
        this._dirty = true;
    }

    setInt(byteOffset: number, value: number): void {
        this._i32[byteOffset >> 2] = value;
        this._dirty = true;
    }

    /**
     * Creates or updates the GPU buffer. Returns the luma.gl Buffer.
     */
    upload(device: Device): LumaBuffer {
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                byteLength: this._byteLength,
                usage: 64 | 8 // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this._dirty = true;
        }
        if (this._dirty) {
            this._gpuBuffer.write(new Uint8Array(this._data));
            this._dirty = false;
        }
        return this._gpuBuffer;
    }

    /**
     * Get the raw data as a Float32Array (for WebGL uniform uploads).
     */
    get data(): Float32Array {
        return this._f32;
    }

    destroy(): void {
        if (this._gpuBuffer) {
            this._gpuBuffer.destroy();
            this._gpuBuffer = null;
        }
    }
}
