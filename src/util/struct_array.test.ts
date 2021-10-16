// @flow

import {test} from '../../util/test';
import {StructArrayLayout3i6, FeatureIndexArray} from '../../../rollup/build/tsc/src/data/array_types';

test('StructArray', (t) => {
    class TestArray extends StructArrayLayout3i6 {}

    t.test('array constructs itself', (t) => {
        const array = new TestArray();
        expect(array.length).toBe(0);
        expect(array.arrayBuffer).toBeTruthy();
        t.end();
    });

    t.test('emplaceBack', (t) => {
        const array = new TestArray();

        expect(0).toBe(array.emplaceBack(1, 7, 3));
        expect(1).toBe(array.emplaceBack(4, 2, 5));

        expect(array.length).toBe(2);

        expect(array.int16.slice(0, 6)).toEqual([1, 7, 3, 4, 2, 5]);

        t.end();
    });

    t.test('emplaceBack gracefully accepts extra arguments', (t) => {
        // emplaceBack is typically used in fairly hot code paths, where
        // conditionally varying the number of arguments can be expensive.
        const array = new TestArray();
        expect((array/*: any*/).emplaceBack(3, 1, 4, 1, 5, 9)).toBe(0);
        expect(array.length).toBe(1);
        expect(array.int16.slice(0, 3)).toEqual([3, 1, 4]);
        t.end();
    });

    t.test('reserve', (t) => {
        const array = new TestArray();

        array.reserve(100);
        const initialCapacity = array.capacity;

        for (let i = 0; i < 100; i++) {
            array.emplaceBack(1, 1, 1);
            expect(array.capacity).toBe(initialCapacity);
        }

        t.end();
    });

    t.test('automatically resizes', (t) => {
        const array = new TestArray();
        const initialCapacity = array.capacity;

        while (initialCapacity > array.length) {
            array.emplaceBack(1, 1, 1);
        }

        expect(array.capacity).toBe(initialCapacity);

        array.emplaceBack(1, 1, 1);
        expect(array.capacity > initialCapacity).toBeTruthy();

        t.end();
    });

    t.test('trims', (t) => {
        const array = new TestArray();
        const capacityInitial = array.capacity;

        array.emplaceBack(1, 1, 1);
        expect(array.capacity).toBe(capacityInitial);

        array._trim();
        expect(array.capacity).toBe(1);
        expect(array.arrayBuffer.byteLength).toBe(array.bytesPerElement);

        t.end();
    });

    t.end();
});

test('FeatureIndexArray', (t) => {
    class TestArray extends FeatureIndexArray {}

    t.test('array constructs itself', (t) => {
        const array = new TestArray();
        expect(array.length).toBe(0);
        expect(array.arrayBuffer).toBeTruthy();
        t.end();
    });

    t.test('emplace and retrieve', (t) => {
        const array = new TestArray();
        expect(0).toBe(array.emplaceBack(1, 7, 3));
        expect(1).toBe(array.emplaceBack(4, 2, 5));

        expect(array.length).toBe(2);

        const elem0 = array.get(0);
        expect(elem0).toBeTruthy();

        expect(elem0.featureIndex).toBe(1);
        expect(elem0.sourceLayerIndex).toBe(7);
        expect(elem0.bucketIndex).toBe(3);

        const elem1 = array.get(1);
        expect(elem1).toBeTruthy();

        expect(elem1.featureIndex).toBe(4);
        expect(elem1.sourceLayerIndex).toBe(2);
        expect(elem1.bucketIndex).toBe(5);

        t.end();
    });

    t.end();
});
