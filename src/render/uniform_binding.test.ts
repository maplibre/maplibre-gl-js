import {describe, test, expect} from 'vitest';
import {type mat4} from 'gl-matrix';
import {type Context} from '../gl/context';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformFloatArray,
    UniformColorArray,
    UniformMatrix4f
} from './uniform_binding';
import {Color} from '@maplibre/maplibre-gl-style-spec';

describe('Uniform Binding', () => {
    test('Uniform1i', () => {
        // test counts ensure we don't call the gl.uniform* setters more than expected
        expect.assertions(4);

        const context = {
            gl: {
                uniform1i: () => { expect(true).toBeTruthy(); }
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
                uniform1f: () => { expect(true).toBeTruthy(); }
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
                uniform2f: () => { expect(true).toBeTruthy(); }
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
                uniform3f: () => { expect(true).toBeTruthy(); }
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
                uniform4f: () => { expect(true).toBeTruthy(); }
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
                uniformMatrix4fv: () => { expect(true).toBeTruthy(); }
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
                uniform4fv: () => { expect(true).toBeTruthy(); }
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

    test('UniformFloatArray', () => {
        expect.assertions(4);

        const context = {
            gl: {
                uniform1fv: () => { expect(true).toBeTruthy(); }
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
