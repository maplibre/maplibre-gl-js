import {VertexBuffer} from './vertex_buffer';
import {StructArrayLayout3i6} from '../data/array_types.g';
import {Context} from '../gl/context';
import gl from 'gl';
import {StructArrayMember} from '../util/struct_array';

describe('VertexBuffer', () => {
    class TestArray extends StructArrayLayout3i6 {}
    const attributes = [
        {name: 'map', components: 1, type: 'Int16', offset: 0},
        {name: 'box', components: 2, type: 'Int16', offset: 4}
    ] as StructArrayMember[];

    test('constructs itself', () => {
        const context = new Context(gl(10, 10) as any);
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
        const context = new Context(gl(10, 10) as any);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        const spy = jest.spyOn(context.gl, 'enableVertexAttribArray').mockImplementation(() => {});
        buffer.enableAttributes(context.gl, {attributes: {map: 5, box: 6}} as any);
        expect(spy.mock.calls).toEqual([[5], [6]]);
    });

    test('setVertexAttribPointers', () => {
        const context = new Context(gl(10, 10) as any);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        const spy = jest.spyOn(context.gl, 'vertexAttribPointer').mockImplementation(() => {});
        buffer.setVertexAttribPointers(context.gl, {attributes: {map: 5, box: 6}} as any, 50);
        expect(spy.mock.calls).toEqual([
            [5, 1, context.gl['SHORT'], false, 6, 300],
            [6, 2, context.gl['SHORT'], false, 6, 304]
        ]);
    });

});
