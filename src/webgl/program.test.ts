import {describe, test, expect, vi} from 'vitest';
import {Context} from './context.ts';
import {Program} from './program.ts';
import {PROJECTION_UBO_BINDING_POINT} from './projection_uniform_buffer.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import type {PreparedShader} from '../shaders/shaders.ts';

const shader: PreparedShader = {vertexSource: '', fragmentSource: '', staticAttributes: [], staticUniforms: []};

describe('Program', () => {
    // binding point 0 is also WebGL's default for every block, so render tests cannot tell whether this happens
    test('binds ProjectionUBO at link time', () => {
        const gl = createNullGL();
        const context = new Context(gl);
        new Program(context, shader, null, () => ({}), false, false, shader, '');
        expect(gl.uniformBlockBinding).not.toHaveBeenCalled();

        vi.mocked(gl.getUniformBlockIndex).mockReturnValue(3);
        const program = new Program(context, shader, null, () => ({}), false, false, shader, '');
        expect(gl.uniformBlockBinding).toHaveBeenCalledWith(program.program, 3, PROJECTION_UBO_BINDING_POINT);
    });
});
