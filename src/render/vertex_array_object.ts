
import type {Program} from './program';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {IndexBuffer} from '../gl/index_buffer';
import type {Context} from '../gl/context';

/**
 * @internal
 * A vertex array object used to pass data to the webgl code
 */
export class VertexArrayObject {
    context: Context;
    boundProgram: Program<any>;
    boundLayoutVertexBuffer: VertexBuffer;
    boundPaintVertexBuffers: Array<VertexBuffer>;
    boundIndexBuffer: IndexBuffer;
    boundVertexOffset: number;
    boundDynamicVertexBuffer: VertexBuffer;
    boundDynamicVertexBuffer2: VertexBuffer;
    boundDynamicVertexBuffer3: VertexBuffer;
    vao: any;

    constructor() {
        this.boundProgram = null;
        this.boundLayoutVertexBuffer = null;
        this.boundPaintVertexBuffers = [];
        this.boundIndexBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffer = null;
        this.vao = null;
    }

    bind(context: Context,
        program: Program<any>,
        layoutVertexBuffer: VertexBuffer,
        paintVertexBuffers: Array<VertexBuffer>,
        indexBuffer?: IndexBuffer | null,
        vertexOffset?: number | null,
        dynamicVertexBuffer?: VertexBuffer | null,
        dynamicVertexBuffer2?: VertexBuffer | null,
        dynamicVertexBuffer3?: VertexBuffer | null) {

        this.context = context;

        let paintBuffersDiffer = this.boundPaintVertexBuffers.length !== paintVertexBuffers.length;
        for (let i = 0; !paintBuffersDiffer && i < paintVertexBuffers.length; i++) {
            if (this.boundPaintVertexBuffers[i] !== paintVertexBuffers[i]) {
                paintBuffersDiffer = true;
            }
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundLayoutVertexBuffer !== layoutVertexBuffer ||
            paintBuffersDiffer ||
            this.boundIndexBuffer !== indexBuffer ||
            this.boundVertexOffset !== vertexOffset ||
            this.boundDynamicVertexBuffer !== dynamicVertexBuffer ||
            this.boundDynamicVertexBuffer2 !== dynamicVertexBuffer2 ||
            this.boundDynamicVertexBuffer3 !== dynamicVertexBuffer3
        );

        if (isFreshBindRequired) {
            this.freshBind(program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2, dynamicVertexBuffer3);
        } else {
            context.bindVertexArray.set(this.vao);

            if (dynamicVertexBuffer) {
                // The buffer may have been updated. Rebind to upload data.
                dynamicVertexBuffer.bind();
            }

            if (indexBuffer && indexBuffer.dynamicDraw) {
                indexBuffer.bind();
            }

            if (dynamicVertexBuffer2) {
                dynamicVertexBuffer2.bind();
            }

            if (dynamicVertexBuffer3) {
                dynamicVertexBuffer3.bind();
            }
        }
    }

    freshBind(program: Program<any>,
        layoutVertexBuffer: VertexBuffer,
        paintVertexBuffers: Array<VertexBuffer>,
        indexBuffer?: IndexBuffer | null,
        vertexOffset?: number | null,
        dynamicVertexBuffer?: VertexBuffer | null,
        dynamicVertexBuffer2?: VertexBuffer | null,
        dynamicVertexBuffer3?: VertexBuffer | null) {

        const numNextAttributes = program.numAttributes;

        const context = this.context;
        const gl = context.gl;

        if (this.vao) this.destroy();
        this.vao = context.createVertexArray();
        context.bindVertexArray.set(this.vao);

        // store the arguments so that we can verify them when the vao is bound again
        this.boundProgram = program;
        this.boundLayoutVertexBuffer = layoutVertexBuffer;
        this.boundPaintVertexBuffers = paintVertexBuffers;
        this.boundIndexBuffer = indexBuffer;
        this.boundVertexOffset = vertexOffset;
        this.boundDynamicVertexBuffer = dynamicVertexBuffer;
        this.boundDynamicVertexBuffer2 = dynamicVertexBuffer2;
        this.boundDynamicVertexBuffer3 = dynamicVertexBuffer3;

        layoutVertexBuffer.enableAttributes(gl, program);
        for (const vertexBuffer of paintVertexBuffers) {
            vertexBuffer.enableAttributes(gl, program);
        }

        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.enableAttributes(gl, program);
        }
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.enableAttributes(gl, program);
        }
        if (dynamicVertexBuffer3) {
            dynamicVertexBuffer3.enableAttributes(gl, program);
        }

        layoutVertexBuffer.bind();
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        for (const vertexBuffer of paintVertexBuffers) {
            vertexBuffer.bind();
            vertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }

        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.bind();
            dynamicVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (indexBuffer) {
            indexBuffer.bind();
        }
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.bind();
            dynamicVertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (dynamicVertexBuffer3) {
            dynamicVertexBuffer3.bind();
            dynamicVertexBuffer3.setVertexAttribPointers(gl, program, vertexOffset);
        }

        context.currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            this.context.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
