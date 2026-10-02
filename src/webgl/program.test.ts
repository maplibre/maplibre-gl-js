import {describe, test, expect} from 'vitest';
import {Program} from './program.ts';

import type {PreparedShader} from '../shaders/shaders.ts';
import type {Context} from './context.ts';

const emptyShader: PreparedShader = {
    fragmentSource: 'void main() {}',
    vertexSource: 'void main() {}',
    staticAttributes: [],
    staticUniforms: [],
};

/**
 * A WebGL stub that fails the link the way Chromium does while a context loss
 * is still propagating: every status check comes back false, `isContextLost()`
 * has not flipped yet, and the info log is empty or null.
 */
function createContext(fragCompileStatus: boolean, fragInfoLog: string | null, programInfoLog: string | null = null): Context {
    const COMPILE_STATUS = 35713;
    const LINK_STATUS = 35714;
    const gl = {
        COMPILE_STATUS,
        LINK_STATUS,
        createProgram: () => ({}),
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: (_program: unknown, pname: number) => pname === LINK_STATUS ? false : true,
        getShaderParameter: (_shader: unknown, pname: number) => pname === COMPILE_STATUS ? fragCompileStatus : true,
        getShaderInfoLog: () => fragInfoLog,
        getProgramInfoLog: () => programInfoLog,
        isContextLost: () => false,
    } as unknown as WebGL2RenderingContext;
    return {gl} as unknown as Context;
}

describe('Program constructor context-loss handling', () => {
    test('a failed compile with an empty info log marks the program as failed to create instead of throwing', () => {
        const context = createContext(false, '');
        const program = new Program(context, emptyShader, null, null, false, false, emptyShader, null);
        expect(program.failedToCreate).toBe(true);
    });

    test('a failed compile with a null info log (context already flagged by the driver) is also tolerated', () => {
        const context = createContext(false, null);
        const program = new Program(context, emptyShader, null, null, false, false, emptyShader, null);
        expect(program.failedToCreate).toBe(true);
    });

    test('a failed link of successfully compiled shaders with an empty info log is tolerated', () => {
        const context = createContext(true, 'unused', '');
        const program = new Program(context, emptyShader, null, null, false, false, emptyShader, null);
        expect(program.failedToCreate).toBe(true);
    });

    test('a real GLSL error (non-empty info log) still throws', () => {
        const context = createContext(false, 'ERROR: 0:1: invalid token');
        expect(() => new Program(context, emptyShader, null, null, false, false, emptyShader, null))
            .toThrow('Could not compile fragment shader: ERROR: 0:1: invalid token');
    });
});
