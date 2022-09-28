import {StructArrayLayout3i6, FeatureIndexArray} from '../data/array_types.g';

describe('StructArray', () => {
    class TestArray extends StructArrayLayout3i6 {}

    test('array constructs itself', () => {
        const array = new TestArray();
        expect(array).toHaveLength(0);
        expect(array.arrayBuffer).toBeTruthy();
    });

    test('emplaceBack', () => {
        const array = new TestArray();

        expect(0).toBe(array.emplaceBack(1, 7, 3));
        expect(1).toBe(array.emplaceBack(4, 2, 5));

        expect(array).toHaveLength(2);

        expect(array.int16.slice(0, 6)).toEqual(new Int16Array([1, 7, 3, 4, 2, 5]));
    });

    test('emplaceBack gracefully accepts extra arguments', () => {
        // emplaceBack is typically used in fairly hot code paths, where
        // conditionally varying the number of arguments can be expensive.
        const array = new TestArray();
        expect((array as any).emplaceBack(3, 1, 4, 1, 5, 9)).toBe(0);
        expect(array).toHaveLength(1);
        expect(array.int16.slice(0, 3)).toEqual(new Int16Array([3, 1, 4]));
    });

    test('reserve', () => {
        const array = new TestArray();

        array.reserve(100);
        const initialCapacity = array.capacity;

        for (let i = 0; i < 100; i++) {
            array.emplaceBack(1, 1, 1);
            expect(array.capacity).toBe(initialCapacity);
        }
    });

    test('automatically resizes', () => {
        const array = new TestArray();
        const initialCapacity = array.capacity;

        while (initialCapacity > array.length) {
            array.emplaceBack(1, 1, 1);
        }

        expect(array.capacity).toBe(initialCapacity);

        array.emplaceBack(1, 1, 1);
        expect(array.capacity > initialCapacity).toBeTruthy();
    });

    test('trims', () => {
        const array = new TestArray();
        const capacityInitial = array.capacity;

        array.emplaceBack(1, 1, 1);
        expect(array.capacity).toBe(capacityInitial);

        array._trim();
        expect(array.capacity).toBe(1);
        expect(array.arrayBuffer.byteLength).toBe(array.bytesPerElement);
    });
});

describe('FeatureIndexArray', () => {
    class TestArray extends FeatureIndexArray {}

    test('array constructs itself', () => {
        const array = new TestArray();
        expect(array).toHaveLength(0);
        expect(array.arrayBuffer).toBeTruthy();
    });

    test('emplace and retrieve', () => {
        const array = new TestArray();
        expect(0).toBe(array.emplaceBack(1, 7, 3));
        expect(1).toBe(array.emplaceBack(4, 2, 5));

        expect(array).toHaveLength(2);

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
    });
});
