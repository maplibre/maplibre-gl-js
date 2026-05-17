/**
 * Frame-arena pool of WebGL2 uniform buffers, keyed by exact byte size.
 *
 * A buffer acquired in frame N is never returned to the freelist until
 * `endFrame()` is called for frame N — so callers can write into it without
 * fearing the GPU is still reading the previous frame's contents from it.
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
            // Allocate storage up front so callers can use `bufferSubData` on every
            // upload (including the first).
            // Without this, the first upload would need `bufferData` and a branch in the caller.
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
