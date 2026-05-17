/**
 * Frame-arena pool of WebGL2 uniform buffers, keyed by exact byte size.
 *
 * `acquire(sizeBytes)` returns a pre-allocated buffer (createBuffer + bufferData)
 * the first time a given size is requested, and a recycled buffer afterwards.
 *
 * `endFrame()` returns all in-flight buffers from the current frame to per-size
 * freelists. This avoids buffer-renaming / in-flight-rewrite stalls — callers
 * never write to a buffer that the GPU might still be reading from in the
 * previous frame.
 */
export class DrawableUBOPool {
    private readonly _gl: WebGL2RenderingContext;
    private readonly _freelist: Map<number, WebGLBuffer[]>;
    private readonly _inFlight: Map<number, WebGLBuffer[]>;

    constructor(gl: WebGL2RenderingContext) {
        this._gl = gl;
        this._freelist = new Map();
        this._inFlight = new Map();
    }

    acquire(sizeBytes: number): WebGLBuffer {
        const free = this._freelist.get(sizeBytes);
        let buffer: WebGLBuffer;
        if (free && free.length > 0) {
            buffer = free.pop()!;
        } else {
            const gl = this._gl;
            buffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
            gl.bufferData(gl.UNIFORM_BUFFER, sizeBytes, gl.DYNAMIC_DRAW);
        }

        let inFlight = this._inFlight.get(sizeBytes);
        if (!inFlight) {
            inFlight = [];
            this._inFlight.set(sizeBytes, inFlight);
        }
        inFlight.push(buffer);
        return buffer;
    }

    endFrame(): void {
        for (const [size, buffers] of this._inFlight) {
            let free = this._freelist.get(size);
            if (!free) {
                free = [];
                this._freelist.set(size, free);
            }
            for (const buf of buffers) free.push(buf);
            buffers.length = 0;
        }
    }
}
