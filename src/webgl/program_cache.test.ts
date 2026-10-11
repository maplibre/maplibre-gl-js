import {describe, test, expect, beforeEach} from 'vitest';
import {Context} from './context.ts';
import {ProgramCache} from './program_cache.ts';
import {shaders} from '../shaders/shaders.ts';
import {createNullGL} from '../util/test/null_gl.ts';

describe('ProgramCache', () => {
    const clippingMaskVariant = {
        name: 'clippingMask',
        programConfiguration: null,
        projectionShaderVariant: {name: 'mercator', define: '#define PROJECTION_MERCATOR', prelude: shaders.projectionMercator},
        showOverdrawInspector: false,
        useTerrain: false,
        defines: []
    };
    let gl: WebGL2RenderingContext;
    let cache: ProgramCache;

    beforeEach(() => {
        gl = createNullGL();
        cache = new ProgramCache(new Context(gl));
    });

    test('returns the same program for the same variant without compiling again', () => {
        const program = cache.getProgram(clippingMaskVariant);

        const cachedProgram = cache.getProgram({...clippingMaskVariant});

        expect(cachedProgram).toBe(program);
        expect(gl.createProgram).toHaveBeenCalledTimes(1);
    });

    test('compiles a new program for a different variant', () => {
        const program = cache.getProgram(clippingMaskVariant);

        const terrainProgram = cache.getProgram({...clippingMaskVariant, useTerrain: true});

        expect(terrainProgram).not.toBe(program);
        expect(gl.createProgram).toHaveBeenCalledTimes(2);
    });

    test('destroy deletes every program', () => {
        const program = cache.getProgram(clippingMaskVariant);
        const terrainProgram = cache.getProgram({...clippingMaskVariant, useTerrain: true});

        cache.destroy();

        expect(gl.deleteProgram).toHaveBeenCalledTimes(2);
        expect(gl.deleteProgram).toHaveBeenCalledWith(program.program);
        expect(gl.deleteProgram).toHaveBeenCalledWith(terrainProgram.program);
    });
});
