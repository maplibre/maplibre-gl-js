import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {roundPolygonCorners} from './round_polygon_corners.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';

function round(p: Point) {
    return {x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100};
}

describe('roundPolygonCorners', () => {
    const canonical = new CanonicalTileID(10, 500, 300);

    test.each([-5, 0, 0.1])('returns original polygon reference when distance is %d', (distance) => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, distance, canonical);
        expect(output).toBe(input);
    });

    test('returns unchanged ring for degenerate line rings', () => {
        const input = [[
            new Point(0, 0),
            new Point(50, 50),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 10, canonical);
        expect(output).toStrictEqual(input);
    });

    test('rounds corners of a square polygon into arc vertices', () => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 10, canonical);
        const points = output[0].map(round);

        expect(points.length).toBe(19);
        expect(points).toEqual(
            [
                {
                    'x': 0,
                    'y': 4.12,
                },
                {
                    'x': 0.55,
                    'y': 2.06,
                },
                {
                    'x': 2.06,
                    'y': 0.55,
                },
                {
                    'x': 4.12,
                    'y': 0,
                },
                {
                    'x': 95.88,
                    'y': 0,
                },
                {
                    'x': 97.46,
                    'y': 0.31,
                },
                {
                    'x': 98.79,
                    'y': 1.21,
                },
                {
                    'x': 99.69,
                    'y': 2.54,
                },
                {
                    'x': 100,
                    'y': 4.12,
                },
                {
                    'x': 100,
                    'y': 95.88,
                },
                {
                    'x': 99.45,
                    'y': 97.94,
                },
                {
                    'x': 97.94,
                    'y': 99.45,
                },
                {
                    'x': 95.88,
                    'y': 100,
                },
                {
                    'x': 4.12,
                    'y': 100,
                },
                {
                    'x': 2.54,
                    'y': 99.69,
                },
                {
                    'x': 1.21,
                    'y': 98.79,
                },
                {
                    'x': 0.31,
                    'y': 97.46,
                },
                {
                    'x': 0,
                    'y': 95.88,
                },
                {
                    'x': 0,
                    'y': 4.12,
                },
            ]
        );
    });

    test('clamps corner rounding distance to 20% of edge length when requested distance is large', () => {
        const input = [[
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 1000, canonical);
        const points = output[0].map(round);

        expect(points.length).toBe(19);
        expect(points).toEqual(
            [
                {
                    'x': 0,
                    'y': 2,
                },
                {
                    'x': 0.27,
                    'y': 1,
                },
                {
                    'x': 1,
                    'y': 0.27,
                },
                {
                    'x': 2,
                    'y': 0,
                },
                {
                    'x': 8,
                    'y': 0,
                },
                {
                    'x': 8.77,
                    'y': 0.15,
                },
                {
                    'x': 9.41,
                    'y': 0.59,
                },
                {
                    'x': 9.85,
                    'y': 1.23,
                },
                {
                    'x': 10,
                    'y': 2,
                },
                {
                    'x': 10,
                    'y': 8,
                },
                {
                    'x': 9.73,
                    'y': 9,
                },
                {
                    'x': 9,
                    'y': 9.73,
                },
                {
                    'x': 8,
                    'y': 10,
                },
                {
                    'x': 2,
                    'y': 10,
                },
                {
                    'x': 1.23,
                    'y': 9.85,
                },
                {
                    'x': 0.59,
                    'y': 9.41,
                },
                {
                    'x': 0.15,
                    'y': 8.77,
                },
                {
                    'x': 0,
                    'y': 8,
                },
                {
                    'x': 0,
                    'y': 2,
                },
            ]
        );
    });

    test('preserves near-zero-degree spike vertex without adding arc points', () => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(0, 0.4),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 5, canonical);
        const points = output[0].map(round);

        expect(points.length).toBe(11);
        expect(points).toEqual( [
            {
                'x': 0,
                'y': 0.08,
            },
            {
                'x': 0.01,
                'y': 0.04,
            },
            {
                'x': 0.04,
                'y': 0.01,
            },
            {
                'x': 0.08,
                'y': 0,
            },
            {
                'x': 100,
                'y': 0,
            },
            {
                'x': 0.08,
                'y': 0.4,
            },
            {
                'x': 0.05,
                'y': 0.39,
            },
            {
                'x': 0.02,
                'y': 0.38,
            },
            {
                'x': 0.01,
                'y': 0.35,
            },
            {
                'x': 0,
                'y': 0.32,
            },
            {
                'x': 0,
                'y': 0.08,
            },
        ]
        );
    });

    test('preserves collinear 180-degree vertices without adding arc points', () => {
        const input = [[
            new Point(0, 0),
            new Point(50, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 5, canonical);
        const points = output[0].map(round);

        expect(points.length).toBe(20);
        expect(points).toEqual(
            [
                {
                    'x': 0,
                    'y': 2.06,
                },
                {
                    'x': 0.28,
                    'y': 1.03,
                },
                {
                    'x': 1.03,
                    'y': 0.28,
                },
                {
                    'x': 2.06,
                    'y': 0,
                },
                {
                    'x': 50,
                    'y': 0,
                },
                {
                    'x': 97.94,
                    'y': 0,
                },
                {
                    'x': 98.73,
                    'y': 0.16,
                },
                {
                    'x': 99.4,
                    'y': 0.6,
                },
                {
                    'x': 99.84,
                    'y': 1.27,
                },
                {
                    'x': 100,
                    'y': 2.06,
                },
                {
                    'x': 100,
                    'y': 97.94,
                },
                {
                    'x': 99.72,
                    'y': 98.97,
                },
                {
                    'x': 98.97,
                    'y': 99.72,
                },
                {
                    'x': 97.94,
                    'y': 100,
                },
                {
                    'x': 2.06,
                    'y': 100,
                },
                {
                    'x': 1.27,
                    'y': 99.84,
                },
                {
                    'x': 0.6,
                    'y': 99.4,
                },
                {
                    'x': 0.16,
                    'y': 98.73,
                },
                {
                    'x': 0,
                    'y': 97.94,
                },
                {
                    'x': 0,
                    'y': 2.06,
                },
            ]
        );
    });
});
