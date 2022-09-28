import TransferableGridIndex from './transferable_grid_index';

describe('TransferableGridIndex', () => {

    test('indexes features', () => {
        const grid = new TransferableGridIndex(100, 4, 1);
        grid.insert(0, 4, 10, 6, 30);
        grid.insert(1, 4, 10, 30, 12);
        grid.insert(2, -10, 30, -5, 35);

        expect(grid.query(4, 10, 5, 11).sort()).toEqual([0, 1]);
        expect(grid.query(24, 10, 25, 11).sort()).toEqual([1]);
        expect(grid.query(40, 40, 100, 100)).toEqual([]);
        expect(grid.query(-6, 0, -7, 100)).toEqual([2]);
        expect(grid.query(-Infinity, -Infinity, Infinity, Infinity).sort()).toEqual([0, 1, 2]);
    });

    test('returns multiple copies of a key if multiple boxes were inserted with the same key', () => {
        const grid = new TransferableGridIndex(100, 4, 0);
        const key = 123;
        grid.insert(key, 3, 3, 4, 4);
        grid.insert(key, 13, 13, 14, 14);
        grid.insert(key, 23, 23, 24, 24);
        expect(grid.query(0, 0, 30, 30)).toEqual([key, key, key]);
    });

    test('serializing to an arraybuffer', () => {
        const originalGrid  = new TransferableGridIndex(100, 4, 1);
        originalGrid.insert(0, 4, 10, 6, 30);
        originalGrid.insert(1, 4, 10, 30, 12);
        originalGrid.insert(2, -10, 30, -5, 35);

        const arrayBuffer = originalGrid.toArrayBuffer();
        const grid = new TransferableGridIndex(arrayBuffer);

        expect(grid.query(4, 10, 5, 11).sort()).toEqual([0, 1]);
        expect(grid.query(24, 10, 25, 11).sort()).toEqual([1]);
        expect(grid.query(40, 40, 100, 100)).toEqual([]);
        expect(grid.query(-6, 0, -7, 100)).toEqual([2]);
        expect(grid.query(-Infinity, -Infinity, Infinity, Infinity).sort()).toEqual([0, 1, 2]);

        expect(() => grid.insert(3, 0, 0, 0, 0)).toThrow();
    });

    test('serialize round trip', () => {
        const grid = new TransferableGridIndex(100, 4, 0);
        const key = 123;
        grid.insert(key, 3, 3, 4, 4);
        grid.insert(key, 13, 13, 14, 14);
        grid.insert(key, 23, 23, 24, 24);
        const serializedGrid = TransferableGridIndex.serialize(grid);
        const deserializedGrid = TransferableGridIndex.deserialize(serializedGrid);
        expect(deserializedGrid.query(0, 0, 30, 30)).toEqual([key, key, key]);
    });

});
