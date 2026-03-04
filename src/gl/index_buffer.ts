
import type {StructArray} from '../util/struct_array';
import type {TriangleIndexArray, LineIndexArray, LineStripIndexArray} from '../data/index_array_type';
import type {Context} from '../gl/context';
import {Buffer as LumaBuffer} from '@luma.gl/core';

/**
 * @internal
 * an index buffer class
 */
export class IndexBuffer {
    context: Context;
    buffer: WebGLBuffer;
    webgpuBuffer: LumaBuffer | null = null;
    dynamicDraw: boolean;

    constructor(context: Context, array: TriangleIndexArray | LineIndexArray | LineStripIndexArray, dynamicDraw?: boolean) {
        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        this.dynamicDraw = Boolean(dynamicDraw);

        if (context.device && context.device.type === 'webgpu') {
            this.webgpuBuffer = context.device.createBuffer({
                usage: LumaBuffer.INDEX | LumaBuffer.COPY_DST,
                indexType: 'uint16',
                data: new Uint8Array(array.arrayBuffer)
            });
        }

        // The bound index buffer is part of vertex array object state. We don't want to
        // modify whatever VAO happens to be currently bound, so make sure the default
        // vertex array provided by the context is bound instead.
        this.context.unbindVAO();

        context.bindElementBuffer.set(this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }

    bind() {
        this.context.bindElementBuffer.set(this.buffer);
    }

    updateData(array: StructArray) {
        const gl = this.context.gl;
        if (!this.dynamicDraw) throw new Error('Attempted to update data while not in dynamic mode.');
        // The right VAO will get this buffer re-bound later in VertexArrayObject.bind
        // See https://github.com/mapbox/mapbox-gl-js/issues/5620
        this.context.unbindVAO();
        this.bind();
        if (this.webgpuBuffer) {
            this.webgpuBuffer.write(new Uint8Array(array.arrayBuffer));
        }
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    destroy() {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
        if (this.webgpuBuffer) {
            this.webgpuBuffer.destroy();
            this.webgpuBuffer = null;
        }
    }
}
