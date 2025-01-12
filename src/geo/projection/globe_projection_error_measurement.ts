import {Color} from '@maplibre/maplibre-gl-style-spec';
import {ColorMode} from '../../gl/color_mode';
import {CullFaceMode} from '../../gl/cull_face_mode';
import {DepthMode} from '../../gl/depth_mode';
import {StencilMode} from '../../gl/stencil_mode';
import {warnOnce} from '../../util/util';
import {projectionErrorMeasurementUniformValues} from '../../render/program/projection_error_measurement_program';
import {Mesh} from '../../render/mesh';
import {SegmentVector} from '../../data/segment';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import posAttributes from '../../data/pos_attributes';
import {type Framebuffer} from '../../gl/framebuffer';
import {isWebGL2} from '../../gl/webgl2';
import {type ProjectionGPUContext} from './projection';

/**
 * For vector globe the vertex shader projects mercator coordinates to angular coordinates on a sphere.
 * This projection requires some inverse trigonometry `atan(exp(...))`, which is inaccurate on some GPUs (mainly on AMD and Nvidia).
 * The inaccuracy is severe enough to require a workaround. The uncorrected map is shifted north-south by up to several hundred meters in some latitudes.
 * Since the inaccuracy is hardware-dependant and may change in the future, we need to measure the error at runtime.
 *
 * Our approach relies on several assumptions:
 *
 * - the error is only present in the "latitude" component (longitude doesn't need any inverse trigonometry)
 * - the error is continuous and changes slowly with latitude
 * - at zoom levels where the error is noticeable, the error is more-or-less the same across the entire visible map area (and thus can be described with a single number)
 *
 * Solution:
 *
 * Every few frames, launch a GPU shader that measures the error for the current map center latitude, and writes it to a 1x1 texture.
 * Read back that texture, and offset the globe projection matrix according to the error (interpolating smoothly from old error to new error if needed).
 * The texture readback is done asynchronously using Pixel Pack Buffers (WebGL2) when possible, and has a few frames of latency, but that should not be a problem.
 *
 * General operation of this class each frame is:
 *
 * - render the error shader into a fbo, read that pixel into a PBO, place a fence
 * - wait a few frames to allow the GPU (and driver) to actually execute the shader
 * - wait for the fence to be signalled (guaranteeing the shader to actually be executed)
 * - read back the PBO's contents
 * - wait a few more frames
 * - repeat
 */
export class ProjectionErrorMeasurement {
    // We wait at least this many frames after measuring until we read back the value.
    // After this period, we might wait more frames until a fence is signalled to make sure the rendering is completed.
    private readonly _readbackWaitFrames = 4;
    // We wait this many frames after *reading back* a measurement until we trigger measure again.
    // We could in theory render the measurement pixel immediately, but we wait to make sure
    // no pipeline stall happens.
    private readonly _measureWaitFrames = 6;
    private readonly _texWidth = 1;
    private readonly _texHeight = 1;
    private readonly _texFormat: number;
    private readonly _texType: number;

    private _fullscreenTriangle: Mesh;
    private _fbo: Framebuffer;
    private _resultBuffer: Uint8Array;
    private _pbo: WebGLBuffer;
    private _cachedRenderContext: ProjectionGPUContext;

    private _measuredError: number = 0; // Result of last measurement
    private _updateCount: number = 0;
    private _lastReadbackFrame: number = -1000;

    get awaitingQuery(): boolean {
        return !!this._readbackQueue;
    }

    // There is never more than one readback waiting
    private _readbackQueue: {
        frameNumberIssued: number; // Frame number when the data was first computed
        sync: WebGLSync;
    } = null;

    public constructor(renderContext: ProjectionGPUContext) {
        this._cachedRenderContext = renderContext;

        const context = renderContext.context;
        const gl = context.gl;

        this._texFormat = gl.RGBA;
        this._texType = gl.UNSIGNED_BYTE;

        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(2, -1);
        vertexArray.emplaceBack(-1, 2);
        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);

        this._fullscreenTriangle = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        this._resultBuffer = new Uint8Array(4);

        context.activeTexture.set(gl.TEXTURE1);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, this._texFormat, this._texWidth, this._texHeight, 0, this._texFormat, this._texType, null);

        this._fbo = context.createFramebuffer(this._texWidth, this._texHeight, false, false);
        this._fbo.colorAttachment.set(texture);

        if (isWebGL2(gl)) {
            this._pbo = gl.createBuffer();
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        }
    }

    public destroy() {
        const gl = this._cachedRenderContext.context.gl;
        this._fullscreenTriangle.destroy();
        this._fbo.destroy();
        gl.deleteBuffer(this._pbo);
        this._fullscreenTriangle = null;
        this._fbo = null;
        this._pbo = null;
        this._resultBuffer = null;
    }

    public updateErrorLoop(normalizedMercatorY: number, expectedAngleY: number): number {
        const currentFrame = this._updateCount;

        if (this._readbackQueue) {
            // Try to read back if enough frames elapsed. Otherwise do nothing, just wait another frame.
            if (currentFrame >= this._readbackQueue.frameNumberIssued + this._readbackWaitFrames) {
                // Try to read back - it is possible that this method does nothing, then
                // the readback queue will not be cleared and we will retry next frame.
                this._tryReadback();
            }
        } else {
            if (currentFrame >= this._lastReadbackFrame + this._measureWaitFrames) {
                this._renderErrorTexture(normalizedMercatorY, expectedAngleY);
            }
        }

        this._updateCount++;
        return this._measuredError;
    }

    private _bindFramebuffer() {
        const context = this._cachedRenderContext.context;
        const gl = context.gl;
        context.activeTexture.set(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._fbo.colorAttachment.get());
        context.bindFramebuffer.set(this._fbo.framebuffer);
    }

    private _renderErrorTexture(input: number, outputExpected: number): void {
        const context = this._cachedRenderContext.context;
        const gl = context.gl;

        // Update framebuffer contents
        this._bindFramebuffer();
        context.viewport.set([0, 0, this._texWidth, this._texHeight]);
        context.clear({color: Color.transparent});

        const program = this._cachedRenderContext.useProgram('projectionErrorMeasurement');

        program.draw(context, gl.TRIANGLES,
            DepthMode.disabled, StencilMode.disabled,
            ColorMode.unblended, CullFaceMode.disabled,
            projectionErrorMeasurementUniformValues(input, outputExpected), null, null,
            '$clipping', this._fullscreenTriangle.vertexBuffer, this._fullscreenTriangle.indexBuffer,
            this._fullscreenTriangle.segments);

        if (this._pbo && isWebGL2(gl)) {
            // Read back into PBO
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.readBuffer(gl.COLOR_ATTACHMENT0);
            gl.readPixels(0, 0, this._texWidth, this._texHeight, this._texFormat, this._texType, 0);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();

            this._readbackQueue = {
                frameNumberIssued: this._updateCount,
                sync,
            };
        } else {
            // Read it back later.
            this._readbackQueue = {
                frameNumberIssued: this._updateCount,
                sync: null,
            };
        }
    }

    private _tryReadback(): void {
        const gl = this._cachedRenderContext.context.gl;

        if (this._pbo && this._readbackQueue && isWebGL2(gl)) {
            // WebGL 2 path
            const waitResult = gl.clientWaitSync(this._readbackQueue.sync, 0, 0);

            if (waitResult === gl.WAIT_FAILED) {
                warnOnce('WebGL2 clientWaitSync failed.');
                this._readbackQueue = null;
                this._lastReadbackFrame = this._updateCount;
                return;
            }

            if (waitResult === gl.TIMEOUT_EXPIRED) {
                return; // Wait one more frame
            }

            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this._resultBuffer, 0, 4);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        } else {
            // WebGL1 compatible
            this._bindFramebuffer();
            gl.readPixels(0, 0, this._texWidth, this._texHeight, this._texFormat, this._texType, this._resultBuffer);
        }

        // If we made it here, _resultBuffer contains the new measurement
        this._readbackQueue = null;
        this._measuredError = ProjectionErrorMeasurement._parseRGBA8float(this._resultBuffer);
        this._lastReadbackFrame = this._updateCount;
    }

    private static _parseRGBA8float(buffer: Uint8Array): number {
        let result = 0;
        result += buffer[0] / 256.0;
        result += buffer[1] / 65536.0;
        result += buffer[2] / 16777216.0;
        if (buffer[3] < 127.0) {
            result = -result;
        }
        return result / 128.0;
    }
}
