import {describe, test, expect, vi} from 'vitest';
import {Context} from './context.ts';
import {Program} from './program.ts';
import {UBO_BINDINGS} from './uniform_buffer.ts';
import {DepthMode} from './depth_mode.ts';
import {StencilMode} from './stencil_mode.ts';
import {ColorMode} from './color_mode.ts';
import {CullFaceMode} from './cull_face_mode.ts';
import {SegmentVector} from '../data/segment.ts';
import {createNullGL} from '../util/test/null_gl.ts';

vi.mock(import('./vertex_array_object.ts'));

describe('Program', () => {
    test('restores dirty UBO bindings before drawing without uploading new uniform data', () => {
        const gl = createNullGL();
        const bindings = new Map<number, WebGLBuffer | null>();
        vi.mocked(gl.bindBufferBase).mockImplementation((_target, index, buffer) => { bindings.set(index, buffer); });
        const context = new Context(gl);
        const buffers = [context.projectionUniformBuffer, context.terrainUniformBuffer, context.frameUniformBuffer];
        for (const buffer of buffers) buffer.upload();
        const source = {vertexSource: '', fragmentSource: '', staticAttributes: [], staticUniforms: []};
        const program = new Program(context, source, null, () => ({}), false, false, source, '');
        const segments = new SegmentVector([{vertexOffset: 0, primitiveOffset: 0, vertexLength: 3, primitiveLength: 1, vaos: {}}]);
        for (const binding of Object.values(UBO_BINDINGS)) gl.bindBufferBase(gl.UNIFORM_BUFFER, binding, null);
        context.setDirty();
        vi.mocked(gl.bindBufferBase).mockClear();
        vi.mocked(gl.bufferSubData).mockClear();
        vi.mocked(gl.drawElements).mockImplementation(() => {
            expect(bindings.get(UBO_BINDINGS.ProjectionUBO)).toBe(context.projectionUniformBuffer.buffer);
            expect(bindings.get(UBO_BINDINGS.TerrainUBO)).toBe(context.terrainUniformBuffer.buffer);
            expect(bindings.get(UBO_BINDINGS.FrameUBO)).toBe(context.frameUniformBuffer.buffer);
        });

        for (let i = 0; i < 2; i++) {
            program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended,
                CullFaceMode.disabled, null, null, null, 'native', null, null, segments);
        }

        expect(gl.drawElements).toHaveBeenCalledTimes(2);
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(3);
        expect(gl.bufferSubData).not.toHaveBeenCalled();
    });
});
