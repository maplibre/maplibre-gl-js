import {describe, test, expect} from 'vitest';
import Bounds from './bounds';
import Point from '@mapbox/point-geometry';

describe('Bounds', () => {
    test('creates an object with default values', () => {
        expect(new Bounds()).toBeInstanceOf(Bounds);
    });

    test('empty()', () => {
        const empty = new Bounds();
        expect(empty.empty()).toBeTruthy();
        expect(empty.contains(new Point(0, 0))).toBeFalsy();
    });

    test('add single point', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(1, 2));
        expect(bounds.empty()).toBeFalsy();
        expect(bounds.contains(new Point(1, 2))).toBeTruthy();
        expect(bounds.contains(new Point(2, 2))).toBeFalsy();
        expect(bounds.contains(new Point(-1, 2))).toBeFalsy();
        expect(bounds.contains(new Point(1, 1))).toBeFalsy();
        expect(bounds.contains(new Point(1, 3))).toBeFalsy();
    });

    test('add multiple points', () => {
        const bounds = new Bounds();
        bounds.extend(new Point(1, 2));
        bounds.extend(new Point(3, 4));
        expect(bounds.empty()).toBeFalsy();
        expect(bounds.contains(new Point(1, 2))).toBeTruthy();
        expect(bounds.contains(new Point(3, 2))).toBeTruthy();
        expect(bounds.contains(new Point(3, 4))).toBeTruthy();
        expect(bounds.contains(new Point(1, 4))).toBeTruthy();

        expect(bounds.contains(new Point(0.9, 1.9))).toBeFalsy();
        expect(bounds.contains(new Point(3.1, 1.9))).toBeFalsy();
        expect(bounds.contains(new Point(3.1, 4.1))).toBeFalsy();
        expect(bounds.contains(new Point(2, 4.1))).toBeFalsy();
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
});
