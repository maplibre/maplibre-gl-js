import {findIntersectionPoint, project} from './projection';

import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';

describe('Projection', () => {
    test('matrix float precision', () => {
        const point = new Point(10.000000005, 0);
        const matrix = mat4.create();
        expect(project(point, matrix).point.x).toBeCloseTo(point.x, 10);
    });

    test('line intersection', () => {
        const horizontal = [
            new Point(0, 0),
            new Point(10, 0)];
        const vertical = [
            new Point(30, -20),
            new Point(30, -10)
        ];
        const intersection = findIntersectionPoint(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(30, 0));
    });

    test('line intersection backwards', () => {
        // Direction of line segments should be irrelevant
        const horizontal = [
            new Point(10, 0),
            new Point(0, 0)];
        const vertical = [
            new Point(30, -10),
            new Point(30, -20)
        ];
        const intersection = findIntersectionPoint(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(30, 0));
    });

    test('crossing line intersection', () => {
        // This should not be possible for two adjacent segments of a line string
        const horizontal = [
            new Point(-10, 0),
            new Point(10, 0)];
        const vertical = [
            new Point(0, -10),
            new Point(0, 10)
        ];
        const intersection = findIntersectionPoint(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(0, 0));
    });

    test('parallel line intersection', () => {
        // Only works when one segment touches the next, but that's guaranteed in our use case
        const first = [
            new Point(0, 0),
            new Point(10, 0)];
        const second = [
            new Point(10, 0),
            new Point(30, 0)
        ];
        const intersection = findIntersectionPoint(first[0], first[1], second[0], second[1]);
        expect(intersection).toEqual(new Point(10, 0));
    });
});
