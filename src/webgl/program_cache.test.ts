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
        defines: [],
        wait: false
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

    describe('with KHR_parallel_shader_compile', () => {
        const COMPLETION_STATUS_KHR = 0x91B1;
        let compiled: boolean;

        beforeEach(() => {
            compiled = false;
            vi.mocked(gl.getExtension).mockImplementation(((name: string) => (name === 'KHR_parallel_shader_compile' ? {COMPLETION_STATUS_KHR} : null)) as typeof gl.getExtension);
            vi.mocked(gl.getProgramParameter).mockImplementation((_program: WebGLProgram, pname: number) => (pname === COMPLETION_STATUS_KHR ? compiled : true));
        });

        const linkStatusReads = () => vi.mocked(gl.getProgramParameter).mock.calls.filter(([, pname]) => pname === gl.LINK_STATUS).length;

        test('returns a still-compiling program without blocking and reports it pending', () => {
            const program = cache.getProgram(clippingMaskVariant);

            expect(program.isReady()).toBe(false);
            expect(linkStatusReads()).toBe(0);
            expect(cache.takePending()).toBe(true);
            expect(cache.takePending()).toBe(false);
        });

        test('completes the program once the driver reports it compiled', () => {
            const program = cache.getProgram(clippingMaskVariant);
            cache.takePending();
            compiled = true;

            expect(cache.getProgram(clippingMaskVariant)).toBe(program);
            expect(program.isReady()).toBe(true);
            expect(linkStatusReads()).toBe(1);
            expect(cache.takePending()).toBe(false);
        });

        test('waits for the compile when asked to', () => {
            const program = cache.getProgram({...clippingMaskVariant, wait: true});

            expect(program.isReady()).toBe(true);
            expect(linkStatusReads()).toBe(1);
            expect(cache.takePending()).toBe(false);
        });
    });

    test('completes programs at once without KHR_parallel_shader_compile', () => {
        const program = cache.getProgram(clippingMaskVariant);

        expect(program.isReady()).toBe(true);
        expect(cache.takePending()).toBe(false);
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
