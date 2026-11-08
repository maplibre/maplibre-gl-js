import {describe, test, expect, beforeEach, vi} from 'vitest';
import {Context} from './context.ts';
import {ProgramCache} from './program_cache.ts';
import {shaders} from '../shaders/shaders.ts';
import {createNullGL} from '../util/test/null_gl.ts';

import type {ProgramConfiguration} from '../data/program_configuration.ts';

/** A configuration that binds no attribute or uniform, so it only tells programs apart by its `cacheKey`. */
function createConfiguration(cacheKey: string): ProgramConfiguration {
    return {
        cacheKey,
        getBinderAttributes: () => [],
        getBinderUniforms: () => [],
        getUniforms: () => [],
        defines: () => []
    } as Partial<ProgramConfiguration> as ProgramConfiguration;
}

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

    test('finds the program of an equal variant made of new objects', () => {
        const program = cache.getProgram({...clippingMaskVariant, programConfiguration: createConfiguration('/u_fill-color')});

        // The map builds a new projection variant every frame, and each bucket has its own configuration.
        const cachedProgram = cache.getProgram({
            ...clippingMaskVariant,
            programConfiguration: createConfiguration(['/u_fill', 'color'].join('-')),
            projectionShaderVariant: {...clippingMaskVariant.projectionShaderVariant},
            defines: []
        });

        expect(cachedProgram).toBe(program);
        expect(gl.createProgram).toHaveBeenCalledTimes(1);
    });

    test('does not build a string key to find a cached program', () => {
        // Every draw call looks its program up, so the lookup must not concatenate a key out of the variant.
        const defines: string[] = [];
        const join = vi.spyOn(defines, 'join');
        const variant = {...clippingMaskVariant, defines};
        cache.getProgram(variant);
        join.mockClear();

        cache.getProgram(variant);

        expect(join).not.toHaveBeenCalled();
    });

    test.each([
        ['name', {name: 'depth'}],
        ['configuration', {programConfiguration: createConfiguration('/u_fill-color')}],
        ['projection', {projectionShaderVariant: {name: 'globe', define: '#define GLOBE', prelude: shaders.projectionGlobe}}],
        ['overdraw inspector', {showOverdrawInspector: true}],
        ['terrain', {useTerrain: true}],
        ['defines', {defines: ['#define TERRAIN_FROM_DEM']}],
    ])('compiles a new program for a variant with a different %s', (_, change) => {
        const program = cache.getProgram(clippingMaskVariant);

        const otherProgram = cache.getProgram({...clippingMaskVariant, ...change});

        expect(otherProgram).not.toBe(program);
        expect(cache.getProgram({...clippingMaskVariant, ...change})).toBe(otherProgram);
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
