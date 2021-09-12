import {test} from '../../util/test';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f
} from '../../../rollup/build/tsc/render/uniform_binding';

test('Uniform1i', (t) => {
    // test counts ensure we don't call the gl.uniform* setters more than expected
    expect.assertions(4);

    const context = {
        gl: {
            uniform1i: () => { expect(true).toBeTruthy(); }
        }
    };

    const u = new Uniform1i(context, 0);

    expect(u.current).toBe(0);
    u.set(1);
    expect(u.current).toBe(1);
    u.set(1);
    u.set(2);
    t.end();
});

test('Uniform1f', (t) => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform1f: () => { expect(true).toBeTruthy(); }
        }
    };

    const u = new Uniform1f(context, 0);

    expect(u.current).toBe(0);
    u.set(1);
    expect(u.current).toBe(1);
    u.set(1);
    u.set(2);
    t.end();
});

test('Uniform2f', (t) => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform2f: () => { expect(true).toBeTruthy(); }
        }
    };

    const u = new Uniform2f(context, 0);

    expect(u.current).toEqual([0, 0]);
    u.set([1, 1]);
    expect(u.current).toEqual([1, 1]);
    u.set([1, 1]);
    u.set([1, 2]);
    t.end();
});

test('Uniform3f', (t) => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform3f: () => { expect(true).toBeTruthy(); }
        }
    };

    const u = new Uniform3f(context, 0);

    expect(u.current).toEqual([0, 0, 0]);
    u.set([1, 1, 1]);
    expect(u.current).toEqual([1, 1, 1]);
    u.set([1, 1, 1]);
    u.set([1, 1, 2]);
    t.end();
});

test('Uniform4f', (t) => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform4f: () => { expect(true).toBeTruthy(); }
        }
    };

    const u = new Uniform4f(context, 0);

    expect(u.current).toEqual([0, 0, 0, 0]);
    u.set([1, 1, 1, 1]);
    expect(u.current).toEqual([1, 1, 1, 1]);
    u.set([1, 1, 1, 1]);
    u.set([2, 1, 1, 1]);
    t.end();
});
