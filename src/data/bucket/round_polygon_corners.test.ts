import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {roundPolygonCorners} from './round_polygon_corners.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';

function round(p: Point):GeoJSON.Position {
    // add 0 to normalize -0 into 0
    const x = Math.round(p.x * 100) / 100 + 0;
    const y = Math.round(p.y * 100) / 100 + 0;
    return [x, y];
}

describe('roundPolygonCorners', () => {
    const canonical = new CanonicalTileID(10, 500, 300);

    test('returns original polygon reference when distance is zero', () => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 0, canonical);
        expect(output).toBe(input);
    });

    test('returns original polygon reference when distance is negative', () => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, -1, canonical);
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

    test('still rounds very small rounding', () => {
        const input = [[
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 0.1, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [0, 0.04], [0.01, 0.02], [0.02, 0.01], [0.04, 0], [9.96, 0], [9.98, 0.01], [9.99, 0.02], [10, 0.04],
            [10, 9.96], [9.99, 9.98], [9.98, 9.99], [9.96, 10], [0.04, 10], [0.02, 9.99], [0.01, 9.98], [0, 9.96], [0, 0.04]
        ]);
    });

    test('rounds corners of a square polygon into arc vertices', () => {
        const input = [[
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 2, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [0, 0.82], [0.11, 0.41], [0.41, 0.11], [0.82, 0], [9.18, 0], [9.59, 0.11], [9.89, 0.41], [10, 0.82],
            [10, 9.18], [9.89, 9.59], [9.59, 9.89], [9.18, 10], [0.82, 10], [0.41, 9.89], [0.11, 9.59], [0, 9.18], [0, 0.82]
        ]);
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

        expect(points).toEqual([
            [0, 2], [0.27, 1], [1, 0.27], [2, 0], [8, 0], [9, 0.27], [9.73, 1], [10, 2],
            [10, 8], [9.73, 9], [9, 9.73], [8, 10], [2, 10], [1, 9.73], [0.27, 9], [0, 8], [0, 2]
        ]);
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

        expect(points).toEqual([
            [0, 0.08], [0.01, 0.04], [0.04, 0.01], [0.08, 0], [100, 0], [0.08, 0.4],
            [0.05, 0.39], [0.02, 0.38], [0.01, 0.35], [0, 0.32], [0, 0.08]
        ]);
    });

    test('preserves collinear 180-degree vertices without adding arc points', () => {
        const input = [[
            new Point(0, 0),
            new Point(5, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 5, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [0, 1], [0.13, 0.5], [0.5, 0.13], [1, 0], [5, 0], [9, 0], [9.5, 0.13], [9.87, 0.5], [10, 1],
            [10, 8], [9.73, 9], [9, 9.73], [8, 10], [2, 10], [1, 9.73], [0.27, 9], [0, 8], [0, 1]
        ]);
    });

    test('scales arc points with corner sharpness up to the segment maximum', () => {
        const input = [[
            new Point(0, 0),
            new Point(100, 0),
            new Point(50, 20),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 5, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [1.91, 0.77], [1.77, 0.66], [1.68, 0.5], [1.67, 0.32], [1.75, 0.16], [1.88, 0.04], [2.06, 0], [97.94, 0], [98.12, 0.04],
            [98.25, 0.16], [98.33, 0.32], [98.32, 0.5], [98.23, 0.66], [98.09, 0.77], [51.91, 19.23], [50, 19.6], [48.09, 19.23], [1.91, 0.77]
        ]);
    });
});
