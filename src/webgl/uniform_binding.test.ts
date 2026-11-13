import {describe, test, expect, vi} from 'vitest';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformFloatArray,
    UniformColor,
    UniformColorArray,
    UniformMatrix4f
} from './uniform_binding.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {Context} from './context.ts';
import {createNullGL} from '../util/test/null_gl.ts';

import type {mat4} from 'gl-matrix';

describe('Uniform Binding', () => {
    test('Uniform1i', () => {
        // test counts ensure we don't call the gl.uniform* setters more than expected
        expect.assertions(4);

        const context = {
            gl: {
                uniform1i: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new Uniform1i(context, 0);

        expect(u.current).toBe(0);
        u.set(1);
        expect(u.current).toBe(1);
        u.set(1);
        u.set(2);
    });

    test('Uniform1f', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform1f: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new Uniform1f(context, 0);

        expect(u.current).toBe(0);
        u.set(1);
        expect(u.current).toBe(1);
        u.set(1);
        u.set(2);
    });

    test('Uniform2f', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform2f: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new Uniform2f(context, 0);

        expect(u.current).toEqual([0, 0]);
        u.set([1, 1]);
        expect(u.current).toEqual([1, 1]);
        u.set([1, 1]);
        u.set([1, 2]);
    });

    test('Uniform3f', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform3f: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new Uniform3f(context, 0);

        expect(u.current).toEqual([0, 0, 0]);
        u.set([1, 1, 1]);
        expect(u.current).toEqual([1, 1, 1]);
        u.set([1, 1, 1]);
        u.set([1, 1, 2]);
    });

    test('Uniform4f', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform4f: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new Uniform4f(context, 0);

        expect(u.current).toEqual([0, 0, 0, 0]);
        u.set([1, 1, 1, 1]);
        expect(u.current).toEqual([1, 1, 1, 1]);
        u.set([1, 1, 1, 1]);
        u.set([2, 1, 1, 1]);
    });

    test('UniformMatrix4f', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniformMatrix4fv: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new UniformMatrix4f(context, 0);
        const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as mat4;
        expect(u.current).toEqual(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        u.set(ident);
        expect(u.current).toEqual(ident);
        u.set(ident);
        u.set([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    });

    test('UniformColorArray', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform4fv: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new UniformColorArray(context, 0);
        expect(u.current).toEqual(new Array<Color>);
        const v = [new Color(0.1, 0.2, 0.3), new Color(0.7, 0.8, 0.9)];
        u.set(v);
        expect(u.current).toEqual(v);
        u.set(v);
        u.set([new Color(0.3, 0.4, 0.5), new Color(0.4, 0.5, 0.6), new Color(0.5, 0.6, 0.7)]);
    });

    test('UniformColor sends sRGB green in Display P3 when the context draws in it', () => {
        const gl = createNullGL();
        gl.drawingBufferColorSpace = 'display-p3';
        const u = new UniformColor(new Context(gl), 0);

        u.set(Color.parse('#00ff00'));

        const [, r, g, b, a] = vi.mocked(gl.uniform4f).mock.calls[0];
        expect(r).toBeCloseTo(0.458402, 5);
        expect(g).toBeCloseTo(0.985265, 5);
        expect(b).toBeCloseTo(0.298295, 5);
        expect(a).toBe(1);
    });

    test('UniformColor sends two colors that clip to the same sRGB color when the context draws in Display P3', () => {
        const gl = createNullGL();
        gl.drawingBufferColorSpace = 'display-p3';
        const u = new UniformColor(new Context(gl), 0);

        u.set(Color.parse('color(display-p3 0 1 0)'));
        u.set(Color.parse('color(display-p3 0.1 1 0)'));

        expect(gl.uniform4f).toHaveBeenCalledTimes(2);
    });

    test('UniformColorArray sends its colors in Display P3 when the context draws in it', () => {
        const gl = createNullGL();
        gl.drawingBufferColorSpace = 'display-p3';
        const u = new UniformColorArray(new Context(gl), 0);

        u.set([Color.parse('#00ff00')]);

        const values = vi.mocked(gl.uniform4fv).mock.calls[0][1];
        expect(values[0]).toBeCloseTo(0.458402, 5);
        expect(values[1]).toBeCloseTo(0.985265, 5);
        expect(values[2]).toBeCloseTo(0.298295, 5);
        expect(values[3]).toBe(1);
    });

    test('UniformFloatArray', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform1fv: () => expect(true).toBeTruthy()
            }
        } as any as Context;

        const u = new UniformFloatArray(context, 0);
        expect(u.current).toEqual(new Array<number>);
        const v = [1.2, 3.4];
        u.set(v);
        expect(u.current).toEqual(v);
        u.set(v);
        u.set([5.6, 7.8, 9.1]);
    });

});
