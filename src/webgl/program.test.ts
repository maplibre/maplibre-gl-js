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

type StubOptions = {
    attachedShaders?: number;
    contextLost?: boolean;
    fragCompileStatus?: boolean;
    vertexCompileStatus?: boolean;
    fragInfoLog?: string | null;
    vertexInfoLog?: string | null;
    programInfoLog?: string | null;
};

/**
 * A WebGL stub that fails the link the way Chromium does while a context loss
 * is still propagating: every query returns 0 or false, the info logs come
 * back empty or null, and `isContextLost()` has not flipped yet. When the GPU
 * is alive, compile statuses and logs report whatever a driver would.
 */
function createContext(options: StubOptions = {}): Context {
    const {
        attachedShaders = 2,
        contextLost = false,
        fragCompileStatus = true,
        vertexCompileStatus = true,
        fragInfoLog = '',
        vertexInfoLog = '',
        programInfoLog = '',
    } = options;
    const COMPILE_STATUS = 35713;
    const LINK_STATUS = 35714;
    const ATTACHED_SHADERS = 35717;
    const gl = {
        COMPILE_STATUS,
        LINK_STATUS,
        ATTACHED_SHADERS,
        createProgram: () => ({}),
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: (_program: unknown, pname: number) => {
            if (pname === LINK_STATUS) return false;
            if (pname === ATTACHED_SHADERS) return attachedShaders;
            return true;
        },
        getShaderParameter: (shader: unknown, pname: number) => pname === COMPILE_STATUS ? (shader === 'vertex' ? vertexCompileStatus : fragCompileStatus) : true,
        getShaderInfoLog: (shader: unknown) => shader === 'vertex' ? vertexInfoLog : fragInfoLog,
        getProgramInfoLog: () => programInfoLog,
        isContextLost: () => contextLost,
    } as unknown as WebGL2RenderingContext;
    const context = {gl} as unknown as Context;
    // The constructor compiles the fragment shader first; tag the stub shaders
    // so getShaderInfoLog can answer for each one.
    let created = 0;
    gl.createShader = () => {
        created++;
        return created === 1 ? 'fragment' : 'vertex';
    };
    return context;
}

describe('Program constructor context-loss handling', () => {
    test('a dead GPU process (zero attached shaders, statuses false, empty logs) is tolerated before isContextLost() flips', () => {
        const context = createContext({attachedShaders: 0, fragCompileStatus: false, vertexCompileStatus: false, fragInfoLog: '', vertexInfoLog: '', programInfoLog: ''});
        const program = new Program(context, emptyShader, null, null, false, false, emptyShader, null);
        expect(program.failedToCreate).toBe(true);
    });

    test('an already flagged lost context is tolerated', () => {
        const context = createContext({contextLost: true, attachedShaders: 2});
        const program = new Program(context, emptyShader, null, null, false, false, emptyShader, null);
        expect(program.failedToCreate).toBe(true);
    });

    test('a real fragment shader error on a live GPU throws with its log', () => {
        const context = createContext({fragCompileStatus: false, fragInfoLog: 'ERROR: 0:1: invalid token'});
        expect(() => new Program(context, emptyShader, null, null, false, false, emptyShader, null))
            .toThrow('Could not compile fragment shader: ERROR: 0:1: invalid token');
    });

    test('a real vertex shader error on a live GPU throws with its log', () => {
        const context = createContext({vertexCompileStatus: false, vertexInfoLog: 'ERROR: 0:1: invalid token'});
        expect(() => new Program(context, emptyShader, null, null, false, false, emptyShader, null))
            .toThrow('Could not compile vertex shader: ERROR: 0:1: invalid token');
    });

    test('a real link failure of compiled shaders on a live GPU throws with its log', () => {
        const context = createContext({programInfoLog: 'linked shaders do not consume all vertex inputs'});
        expect(() => new Program(context, emptyShader, null, null, false, false, emptyShader, null))
            .toThrow('Program failed to link: linked shaders do not consume all vertex inputs');
    });

    test('a live GPU link failure with an empty info log still throws instead of reading as a context loss', () => {
        const context = createContext({programInfoLog: ''});
        expect(() => new Program(context, emptyShader, null, null, false, false, emptyShader, null))
            .toThrow('Program failed to link');
    });
});
