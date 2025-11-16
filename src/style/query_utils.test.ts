import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';

import {offsetLine} from './query_utils';

const defaultPrecision = 10;

const closeTo = (expected, precision = defaultPrecision) => ({
    asymmetricMatch: (actual) => Math.abs(expected - actual) < Math.pow(10, -precision) / 2
});

describe('offsetLine', () => {
    test('line two points east', () => {
        const line = [
            new Point(0, 0),
            new Point(1, 0)
        ];
        const offset = 1;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(0, 1),
            new Point(1, 1)
        ]]);
    });

    test('line two points west', () => {
        const line = [
            new Point(10, 10),
            new Point(5, 10)
        ];
        const offset = 2;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(10, 8),
            new Point(5, 8)
        ]]);
    });

    test('line two points south', () => {
        const line = [
            new Point(0, -1),
            new Point(0, 1)
        ];
        const offset = 1;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(-1, -1),
            new Point(-1, 1)
        ]]);
    });

    test('line three points north', () => {
        const line = [
            new Point(0, 1),
            new Point(0, 0),
            new Point(0, -1)
        ];
        const offset = 1;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(1, 1),
            new Point(1, 0),
            new Point(1, -1)
        ]]);
    });

    test('line with duplicate points', () => {
        const line = [
            new Point(0, 1),
            new Point(0, 0),
            new Point(0, 0),
            new Point(0, -1),
            new Point(0, -1)
        ];
        const offset = 1;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(1, 1),
            new Point(1, 0),
            new Point(1, -1)
        ]]);
    });

    test('line with more than two consecutive duplicate points', () => {
        const line = [
            new Point(0, 1),
            new Point(0, 1),
            new Point(0, 1),
            new Point(0, 0),
            new Point(0, 0),
            new Point(0, -1),
            new Point(0, -1)
        ];
        const offset = 1;

        expect(offsetLine([line], offset)).toEqual([[
            new Point(1, 1),
            new Point(1, 0),
            new Point(1, -1)
        ]]);
    });

    test('line three points north east', () => {
        const line = [
            new Point(-1, 1),
            new Point(0, 0),
            new Point(1, -1)
        ];
        const offset = Math.sqrt(2);

        expect(offsetLine([line], offset)).toEqual([[
            {
                x: closeTo(0),
                y: closeTo(2)
            },
            {
                x: closeTo(1),
                y: closeTo(1)
            },
            {
                x: closeTo(2),
                y: closeTo(0)
            }
        ]]);
    });

    test('ring five points square', () => {
        const ring = [
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, -10),
            new Point(0, -10),
            new Point(0, 0)
        ];
        const offset = 2;
        expect(offsetLine([ring], offset)).toEqual([[
            new Point(0, 2),
            new Point(12, 2),
            new Point(12, -12),
            new Point(-2, -12),
            new Point(-2, 0)
        ]]);
    });
});
