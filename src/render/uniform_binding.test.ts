import {mat4} from 'gl-matrix';
import Context from '../gl/context';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformMatrix4f
} from './uniform_binding';

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

});
