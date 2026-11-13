import {describe, test, expect, beforeEach, vi} from 'vitest';
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

    test('compiles a program per shader, projection variant, overdraw switch and list of defines', () => {
        const globeVariant = {name: 'globe', define: '#define GLOBE', prelude: shaders.projectionGlobe};
        const variants = [
            clippingMaskVariant,
            {...clippingMaskVariant, name: 'background'},
            {...clippingMaskVariant, projectionShaderVariant: globeVariant},
            {...clippingMaskVariant, showOverdrawInspector: true},
            {...clippingMaskVariant, showOverdrawInspector: true, useTerrain: true},
            {...clippingMaskVariant, defines: ['#define A']},
            {...clippingMaskVariant, defines: ['#define A', '#define B']},
        ];

        const programs = variants.map((variant) => cache.getProgram(variant));

        expect(new Set(programs).size).toBe(variants.length);
        expect(variants.map((variant) => cache.getProgram({...variant}))).toEqual(programs);
        expect(gl.createProgram).toHaveBeenCalledTimes(variants.length);
    });

    test('destroy deletes every program in the order they were compiled', () => {
        const terrainProgram = cache.getProgram({...clippingMaskVariant, useTerrain: true});
        const backgroundProgram = cache.getProgram({...clippingMaskVariant, name: 'background'});
        const program = cache.getProgram(clippingMaskVariant);

        cache.destroy();

        expect(vi.mocked(gl.deleteProgram).mock.calls).toEqual([[terrainProgram.program], [backgroundProgram.program], [program.program]]);
    });
});
