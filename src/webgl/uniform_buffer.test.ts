import {describe, test, expect, beforeEach, vi} from 'vitest';
import {Context} from './context.ts';
import {UBO_BINDINGS, UniformBuffer, std140Layout} from './uniform_buffer.ts';
import {createNullGL} from '../util/test/null_gl.ts';

describe('std140Layout', () => {
    test('aligns members and pads the size to 16 bytes', () => {
        const layout = std140Layout([
            {name: 'a', type: 'float'},
            {name: 'b', type: 'vec2'},
            {name: 'c', type: 'mat4'},
            {name: 'd', type: 'int'},
        ]);
        expect(layout.offsets).toEqual({a: 0, b: 2, c: 4, d: 20});
        expect(layout.contentWords).toBe(21);
        expect(layout.sizeWords).toBe(24);
    });
});

describe('UniformBuffer', () => {
    let gl: WebGL2RenderingContext;
    let context: Context;
    let buffer: UniformBuffer;

    beforeEach(() => {
        gl = createNullGL();
        context = new Context(gl);
        buffer = new UniformBuffer(context, 5, std140Layout([{name: 'value', type: 'vec4'}, {name: 'flag', type: 'int'}]));
        vi.mocked(gl.bindBufferBase).mockClear();
    });

    test('uploads only when the content changes', () => {
        buffer.pending.set([1, 2, 3, 4]);
        buffer.upload();
        buffer.upload();
        expect(gl.bufferSubData).toHaveBeenCalledTimes(1);

        buffer.pending[3] = 5;
        buffer.upload();
        buffer.pendingWords[4] = 1;
        buffer.upload();
        expect(gl.bufferSubData).toHaveBeenCalledTimes(3);
    });

    test('rebinds after the context is reset, without a new upload', () => {
        const projection = context.projectionUniformBuffer;
        projection.upload();
        context.setDirty();
        projection.upload();
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(1);
        expect(gl.bindBufferBase).toHaveBeenCalledWith(gl.UNIFORM_BUFFER, UBO_BINDINGS.ProjectionUBO, projection.buffer);
        expect(gl.bufferSubData).toHaveBeenCalledTimes(1);
    });

    test('destroy deletes the buffer once', () => {
        const handle = buffer.buffer;
        buffer.destroy();
        buffer.destroy();
        expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
        expect(gl.deleteBuffer).toHaveBeenCalledWith(handle);
    });
});
