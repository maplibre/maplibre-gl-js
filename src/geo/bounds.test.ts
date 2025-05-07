import {describe, test, expect} from 'vitest';
import {Bounds} from './bounds';
import Point from '@mapbox/point-geometry';

function bounds(minX: number, minY: number, maxX: number, maxY: number): Bounds {
    return Bounds.fromPoints([
        new Point(minX, minY),
        new Point(maxX, maxY),
    ]);
}

describe('Bounds', () => {
    test('empty bounding box', () => {
        const empty = new Bounds();
        expect(empty).toBeInstanceOf(Bounds);
        expect(empty.contains(new Point(0, 0))).toBeFalsy();
        expect(empty.empty()).toBeTruthy();
    });

    test('add single point', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(1, 2));
        expect(bounds.empty()).toBeFalsy();
        expect(bounds.height()).toEqual(0);
        expect(bounds.width()).toEqual(0);

        expect(bounds.contains(new Point(1, 2))).toBeTruthy();
        expect(bounds.contains(new Point(2, 2))).toBeFalsy();
        expect(bounds.contains(new Point(-1, 2))).toBeFalsy();
        expect(bounds.contains(new Point(1, 1))).toBeFalsy();
        expect(bounds.contains(new Point(1, 3))).toBeFalsy();
    });

    test('add multiple points', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(1, 2));
        bounds.extend(new Point(3, 5));
        expect(bounds.empty()).toBeFalsy();
        expect(bounds.width()).toEqual(2);
        expect(bounds.height()).toEqual(3);

        expect(bounds.contains(new Point(1, 2))).toBeTruthy();
        expect(bounds.contains(new Point(3, 2))).toBeTruthy();
        expect(bounds.contains(new Point(3, 5))).toBeTruthy();
        expect(bounds.contains(new Point(1, 5))).toBeTruthy();

        expect(bounds.contains(new Point(0.9, 1.9))).toBeFalsy();
        expect(bounds.contains(new Point(3.1, 1.9))).toBeFalsy();
        expect(bounds.contains(new Point(3.1, 5.1))).toBeFalsy();
        expect(bounds.contains(new Point(2, 5.1))).toBeFalsy();
    });

    test('fromPoints', () => {
        const bounds = Bounds.fromPoints([new Point(1, 2), new Point(3, 4)]);
        expect(bounds).toMatchObject({
            minX: 1,
            maxX: 3,
            minY: 2,
            maxY: 4,
        });
    });

    test('expandBy positive', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(0, 0));
        bounds.expandBy(1);
        expect(bounds).toMatchObject({
            minX: -1,
            maxX: 1,
            minY: -1,
            maxY: 1,
        });
    });

    test('expandBy negative', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(0, 0));
        bounds.expandBy(2);
        bounds.expandBy(-1);
        expect(bounds.empty()).toBeFalsy();
        expect(bounds).toMatchObject({
            minX: -1,
            maxX: 1,
            minY: -1,
            maxY: 1,
        });
    });

    test('shrinkBy', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(0, 0));
        bounds.expandBy(2);
        bounds.shrinkBy(1);
        expect(bounds.empty()).toBeFalsy();
        expect(bounds).toMatchObject({
            minX: -1,
            maxX: 1,
            minY: -1,
            maxY: 1,
        });
    });

    test('expandBy collapse', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(0, 0));
        bounds.expandBy(2);
        bounds.expandBy(-3);
        expect(bounds.empty()).toBeTruthy();
    });

    test('map', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(1, 2));
        bounds.extend(new Point(3, 4));
        expect(bounds.map(point => new Point(-point.y, -point.x))).toEqual({
            minX: -4,
            minY: -3,
            maxX: -2,
            maxY: -1,
        });
    });

    test('covers', () => {
        const e = 0.1;
        const box = bounds(1, 2, 3, 4);
        expect(box.covers(box)).toBeTruthy();
        expect(box.covers(bounds(1-e, 2, 3, 4))).toBeFalsy();
        expect(box.covers(bounds(1, 2-e, 3, 4))).toBeFalsy();
        expect(box.covers(bounds(1, 2, 3+e, 4))).toBeFalsy();
        expect(box.covers(bounds(1, 2, 3, 4+e))).toBeFalsy();

        expect(box.covers(bounds(1+e, 2, 3, 4))).toBeTruthy();
        expect(box.covers(bounds(1, 2+e, 3, 4))).toBeTruthy();
        expect(box.covers(bounds(1, 2, 3-e, 4))).toBeTruthy();
        expect(box.covers(bounds(1, 2, 3, 4-e))).toBeTruthy();
    });

    test('intersects', () => {
        const e = 0.1;
        const box = bounds(1, 2, 3, 4);
        expect(box.intersects(box)).toBeTruthy();
        // bottom-left corner
        expect(box.intersects(bounds(0, 0, 1, 2))).toBeTruthy();
        expect(box.intersects(bounds(0, 0, 1-e, 2))).toBeFalsy();
        expect(box.intersects(bounds(0, 0, 1, 2-e))).toBeFalsy();
        // bottom-right corner
        expect(box.intersects(bounds(3, 0, 10, 2))).toBeTruthy();
        expect(box.intersects(bounds(3+e, 0, 10, 2))).toBeFalsy();
        expect(box.intersects(bounds(3, 0, 10, 2-e))).toBeFalsy();
        // top-left corner
        expect(box.intersects(bounds(0, 4, 1, 8))).toBeTruthy();
        expect(box.intersects(bounds(0, 4+e, 1, 8))).toBeFalsy();
        expect(box.intersects(bounds(0, 4, 1-e, 8))).toBeFalsy();
        // top-right corner
        expect(box.intersects(bounds(3, 4, 10, 10))).toBeTruthy();
        expect(box.intersects(bounds(3+e, 4, 10, 10))).toBeFalsy();
        expect(box.intersects(bounds(3, 4+e, 10, 10))).toBeFalsy();
    });
});
