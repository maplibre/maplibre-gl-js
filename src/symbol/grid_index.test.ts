import {GridIndex} from './grid_index';
import type {GridKey} from './grid_index';

describe('GridIndex', () => {

    test('indexes features', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insert(0 as GridKey, 4, 10, 6, 30);
        grid.insert(1 as GridKey, 4, 10, 30, 12);
        grid.insert(2 as GridKey, -10, 30, 5, 35);

        expect(grid.query(4, 10, 5, 11).map(x => x.key).sort()).toEqual([0, 1]);
        expect(grid.query(24, 10, 25, 11).map(x => x.key).sort()).toEqual([1]);
        expect(grid.query(40, 40, 100, 100).map(x => x.key)).toEqual([]);
        expect(grid.query(-6, 0, 3, 100).map(x => x.key)).toEqual([2]);
        expect(
            grid.query(-Infinity, -Infinity, Infinity, Infinity).map(x => x.key).sort()
        ).toEqual([0, 1, 2]);
    });

    test('returns multiple copies of a key if multiple boxes were inserted with the same key', () => {
        const grid = new GridIndex(100, 100, 10);
        const key = 123 as GridKey;
        grid.insert(key, 3, 3, 4, 4);
        grid.insert(key, 13, 13, 14, 14);
        grid.insert(key, 23, 23, 24, 24);
        expect(grid.query(0, 0, 30, 30).map(x => x.key)).toEqual([key, key, key]);
    });

    test('circle-circle intersection', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0 as GridKey, 50, 50, 10);
        grid.insertCircle(1 as GridKey, 60, 60, 15);
        grid.insertCircle(2 as GridKey, -10, 110, 20);

        expect(grid.hitTestCircle(55, 55, 2, 'never')).toBeTruthy();
        expect(grid.hitTestCircle(10, 10, 10, 'never')).toBeFalsy();
        expect(grid.hitTestCircle(0, 100, 10, 'never')).toBeTruthy();
        expect(grid.hitTestCircle(80, 60, 10, 'never')).toBeTruthy();
    });

    test('circle-rectangle intersection', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0 as GridKey, 50, 50, 10);
        grid.insertCircle(1 as GridKey, 60, 60, 15);
        grid.insertCircle(2 as GridKey, -10, 110, 20);

        expect(grid.query(45, 45, 55, 55).map(x => x.key)).toEqual([0, 1]);
        expect(grid.query(0, 0, 30, 30).map(x => x.key)).toEqual([]);
        expect(grid.query(0, 80, 20, 100).map(x => x.key)).toEqual([2]);
    });

    test('overlap mode', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insert({overlapMode: 'never'}, 10, 10, 20, 20);
        grid.insert({overlapMode: 'always'}, 30, 10, 40, 20);
        grid.insert({overlapMode: 'cooperative'}, 50, 10, 60, 20);

        // 'never' can't overlap anything
        expect(grid.hitTest(15, 15, 25, 25, 'never')).toBeTruthy();
        expect(grid.hitTest(35, 15, 45, 25, 'never')).toBeTruthy();
        expect(grid.hitTest(55, 15, 65, 25, 'never')).toBeTruthy();

        // 'always' can overlap everything
        expect(grid.hitTest(15, 15, 25, 25, 'always')).toBeFalsy();
        expect(grid.hitTest(35, 15, 45, 25, 'always')).toBeFalsy();
        expect(grid.hitTest(55, 15, 65, 25, 'always')).toBeFalsy();

        // 'cooperative' can overlap 'always' and 'cooperative'
        expect(grid.hitTest(15, 15, 25, 25, 'cooperative')).toBeTruthy();
        expect(grid.hitTest(35, 15, 45, 25, 'cooperative')).toBeFalsy();
        expect(grid.hitTest(55, 15, 65, 25, 'cooperative')).toBeFalsy();
    });

});
