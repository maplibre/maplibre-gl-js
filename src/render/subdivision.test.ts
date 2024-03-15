import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {subdivideVertexLine} from './subdivision';

/**
 * With this granularity, all geometry should be subdivided along axes divisible by 4.
 */
const granularityInterval4 = EXTENT / 4;

describe('Line geometry subdivision', () => {
    test('Simple line', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(1, 1),
            new Point(6, 1),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(1, 1),
            new Point(4, 1),
            new Point(6, 1),
        ]));
    });

    test('Line lies on subdivision axis', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(1, 0),
            new Point(6, 0),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(1, 0),
            new Point(4, 0),
            new Point(6, 0),
        ]));
    });

    test('Line circles a subdivision cell', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 0),
            new Point(4, 4),
            new Point(0, 4),
            new Point(0, 0),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 0),
            new Point(4, 4),
            new Point(0, 4),
            new Point(0, 0),
        ]));
    });

    test('Line goes through cell vertices', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 4),
            new Point(8, 4),
            new Point(8, 8),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 4),
            new Point(8, 4),
            new Point(8, 8),
        ]));
    });

    test('Line crosses several cells', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(12, 5),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 2),
            new Point(8, 3),
            new Point(10, 4),
            new Point(12, 5),
        ]));
    });

    test('Line crosses several cells in negative coordinates', () => {
        // Same geometry as the previous test, just shifted by -1000 in both axes
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-1000, -1000),
            new Point(-1012, -1005),
        ], granularityInterval4))).toEqual(toSimplePoints([
            new Point(-1000, -1000),
            new Point(-1004, -1002),
            new Point(-1008, -1003),
            new Point(-1010, -1004),
            new Point(-1012, -1005),
        ]));
    });

    test('Line is unmodified at granularity 1', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], 1))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });

    test('Line is unmodified at granularity 0', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], 0))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });

    test('Line is unmodified at granularity -2', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], -2))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });
});

/**
 * Converts an array of points into an array of simple \{x, y\} objects.
 * Jest prints much nicer comparisons on arrays of these simple objects than on
 * arrays of points.
 */
function toSimplePoints(a: Array<Point>): Array<{x: number; y: number}> {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result.push({
            x: a[i].x,
            y: a[i].y,
        });
    }
    return result;
}
