import {describe, beforeEach, test, expect, vi} from 'vitest';
import {VertexBuffer} from './vertex_buffer';
import {StructArrayLayout3i6} from '../data/array_types.g';
import {Context} from './context';
import {type StructArrayMember} from '../util/struct_array';

describe('VertexBuffer', () => {
    let gl: WebGLRenderingContext;

    beforeEach(() => {
        gl = document.createElement('canvas').getContext('webgl');
    });

    class TestArray extends StructArrayLayout3i6 {}
    const attributes = [
        {name: 'map', components: 1, type: 'Int16', offset: 0},
        {name: 'box', components: 2, type: 'Int16', offset: 4}
    ] as StructArrayMember[];

    test('constructs itself', () => {
        const context = new Context(gl);
        const array = new TestArray();
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);

        const buffer = new VertexBuffer(context, array, attributes);

        expect(buffer.attributes).toEqual([
            {name: 'map', components: 1, type: 'Int16', offset: 0},
            {name: 'box', components: 2, type: 'Int16', offset: 4}
        ]);
        expect(buffer.itemSize).toBe(6);
        expect(buffer).toHaveLength(3);
    });

    test('enableAttributes', () => {
        const context = new Context(gl);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        const spy = vi.spyOn(context.gl, 'enableVertexAttribArray').mockImplementation(() => {});
        buffer.enableAttributes(context.gl, {attributes: {map: 5, box: 6}} as any);
        expect(spy.mock.calls).toEqual([[5], [6]]);
    });

    test('setVertexAttribPointers', () => {
        const context = new Context(gl);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        const spy = vi.spyOn(context.gl, 'vertexAttribPointer').mockImplementation(() => {});
        buffer.setVertexAttribPointers(context.gl, {attributes: {map: 5, box: 6}} as any, 50);
        expect(spy.mock.calls).toEqual([
            [5, 1, context.gl['SHORT'], false, 6, 300],
            [6, 2, context.gl['SHORT'], false, 6, 304]
        ]);
    });

    test('static buffer frees StructArray typed views after upload', () => {
        const context = new Context(gl);
        const array = new TestArray();
        array.emplaceBack(1, 2, 3);
        array.emplaceBack(4, 5, 6);

        const originalBuffer = array.arrayBuffer;
        expect(originalBuffer.byteLength).toBeGreaterThan(0);
        expect(array.int16.buffer).toBe(originalBuffer);

        // Static upload (dynamicDraw = false)
        new VertexBuffer(context, array, attributes);

        expect(array.arrayBuffer.byteLength).toBe(0);
        expect(array.int16.buffer).not.toBe(originalBuffer);
        expect(array.int16.length).toBe(0);
    });

    test('dynamic buffer preserves StructArray data after upload', () => {
        const context = new Context(gl);
        const array = new TestArray();
        array.emplaceBack(1, 2, 3);

        const originalBuffer = array.arrayBuffer;

        // Dynamic upload (dynamicDraw = true)
        new VertexBuffer(context, array, attributes, true);

        // Data should be preserved for future updateData() calls
        expect(array.arrayBuffer).toBe(originalBuffer);
        expect(array.int16.length).toBeGreaterThan(0);
    });

});
