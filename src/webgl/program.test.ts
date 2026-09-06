import {describe, expect, test, vi} from 'vitest';
import {Program} from './program.ts';
import {Context} from './context.ts';
import {shaders} from '../shaders/shaders.ts';
import {programUniforms} from './program/program_uniforms.ts';
import {createNullGL} from '../util/test/null_gl.ts';

function createProgram(gl: WebGL2RenderingContext) {
    return new Program(new Context(gl), shaders.background, null, programUniforms.background, false, false, shaders.projectionMercator, '#define GLOBE_MERCATOR_TRANSITION 0.0', []);
}

describe('Program', () => {
    test('compiles both shaders and links before asking the driver how any of it went', () => {
        const gl = createNullGL();

        createProgram(gl);

        const [firstCompile, secondCompile] = vi.mocked(gl.compileShader).mock.invocationCallOrder;
        const [link] = vi.mocked(gl.linkProgram).mock.invocationCallOrder;
        const programParameter = vi.mocked(gl.getProgramParameter);
        expect(firstCompile).toBeLessThan(secondCompile);
        expect(secondCompile).toBeLessThan(link);
        expect(programParameter.mock.calls[0][1]).toBe(gl.LINK_STATUS);
        expect(programParameter.mock.invocationCallOrder[0]).toBeGreaterThan(link);
        expect(gl.getShaderParameter).not.toHaveBeenCalled();
    });

    test.each([
        ['fragment', 'FRAGMENT_SHADER'],
        ['vertex', 'VERTEX_SHADER'],
    ] as const)('names the %s shader when the link fails because it did not compile', (name, type) => {
        const gl = createNullGL();
        const shaderTypes = new Map<WebGLShader, number>();
        vi.mocked(gl.createShader).mockImplementation((shaderType) => {
            const shader = {} as WebGLShader;
            shaderTypes.set(shader, shaderType);
            return shader;
        });
        vi.mocked(gl.getProgramParameter).mockImplementation((_, pname) => pname !== gl.LINK_STATUS);
        vi.mocked(gl.getShaderParameter).mockImplementation((shader) => shaderTypes.get(shader) !== gl[type]);
        vi.mocked(gl.getShaderInfoLog).mockReturnValue(`ERROR: 0:1: bad ${name} shader`);

        expect(() => createProgram(gl)).toThrow(`Could not compile ${name} shader: ERROR: 0:1: bad ${name} shader`);
        expect(gl.getShaderParameter).toHaveBeenCalledWith(expect.anything(), gl.COMPILE_STATUS);
    });

    test('gives up quietly instead of blaming a shader when the context was lost', () => {
        const gl = createNullGL();
        vi.mocked(gl.getProgramParameter).mockImplementation((_, pname) => pname !== gl.LINK_STATUS);
        vi.mocked(gl.linkProgram).mockImplementation(() => {
            vi.mocked(gl.isContextLost).mockReturnValue(true);
        });

        expect(createProgram(gl).failedToCreate).toBe(true);
    });

    test('reports a link failure when both shaders compiled', () => {
        const gl = createNullGL();
        vi.mocked(gl.getProgramParameter).mockImplementation((_, pname) => pname !== gl.LINK_STATUS);
        vi.mocked(gl.getProgramInfoLog).mockReturnValue('varyings do not match');

        expect(() => createProgram(gl)).toThrow('Program failed to link: varyings do not match');
    });
});
