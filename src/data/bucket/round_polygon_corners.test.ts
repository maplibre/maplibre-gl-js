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

const square = [
    new Point(0, 0),
    new Point(10, 0),
    new Point(10, 10),
    new Point(0, 10),
    new Point(0, 0)
];

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

    test('collapses every arc back onto its corner when the distance is below one tile unit', () => {
        const output = roundPolygonCorners([square], 0.1, canonical);

        expect(output[0].map(round)).toEqual(square.map(round));
    });

    test('rounds corners of a square polygon into arc vertices', () => {
        const output = roundPolygonCorners([square], 2, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [0, 1], [0, 0], [1, 0], [9, 0], [10, 0], [10, 1],
            [10, 9], [10, 10], [9, 10], [1, 10], [0, 10], [0, 9], [0, 1]
        ]);
    });

    test('clamps corner rounding distance to 20% of edge length when requested distance is large', () => {
        const output = roundPolygonCorners([square], 1000, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [0, 2], [0, 1], [1, 0], [2, 0], [8, 0], [9, 0], [10, 1], [10, 2],
            [10, 8], [10, 9], [9, 10], [8, 10], [2, 10], [1, 10], [0, 9], [0, 8], [0, 2]
        ]);
    });

    test('emits only integer tile coordinates, so that the triangulator cannot merge arc points itself', () => {
        const input = [[
            new Point(0, 0),
            new Point(137, 41),
            new Point(96, 158),
            new Point(13, 111),
            new Point(0, 0)
        ]];

        for (const distance of [0.5, 1, 2, 5, 50, 1000]) {
            for (const ring of roundPolygonCorners(input, distance, canonical)) {
                for (const point of ring) {
                    expect(point.x).toBe(Math.round(point.x));
                    expect(point.y).toBe(Math.round(point.y));
                }
            }
        }
    });

    test('leaves the corners of a cut sharp and rounds the rest of the same ring', () => {
        const input = [[
            new Point(1000, -100),
            new Point(3000, -100),
            new Point(3000, 4000),
            new Point(1000, 4000),
            new Point(1000, -100)
        ]];

        const output = roundPolygonCorners(input, 1000, canonical);
        const points = output[0].map(round);

        expect(points).toEqual([
            [1000, -100],
            [3000, -100],
            [3000, 3600],
            [2946, 3800],
            [2800, 3946],
            [2600, 4000],
            [1400, 4000],
            [1200, 3946],
            [1054, 3800],
            [1000, 3600],
            [1000, -100]
        ]);
    });

    test('rounds a corner of the feature that sits in the buffer, since only a cut stays sharp', () => {
        const input = [[
            new Point(1200, 200),
            new Point(2000, -100),
            new Point(2800, 200),
            new Point(2000, 3000),
            new Point(1200, 200)
        ]];

        const output = roundPolygonCorners(input, 1000, canonical);
        const points = output[0].map(round);

        expect(points).not.toContainEqual([2000, -100]);
        expect(output[0].length).toBeGreaterThan(input[0].length);
    });

    test('drops arc points that collapse onto their neighbour', () => {
        const output = roundPolygonCorners([square], 2, canonical);
        const ring = output[0];

        for (let i = 1; i < ring.length; i++) {
            expect([ring[i].x, ring[i].y]).not.toEqual([ring[i - 1].x, ring[i - 1].y]);
        }
        expect([ring[0].x, ring[0].y]).toEqual([ring[ring.length - 1].x, ring[ring.length - 1].y]);
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

        expect(points).toEqual([[0, 0], [100, 0], [0, 0.4], [0, 0]]);
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
            [0, 1], [0, 0], [1, 0], [5, 0], [9, 0], [10, 0], [10, 1],
            [10, 8], [10, 9], [9, 10], [8, 10], [2, 10], [1, 10], [0, 9], [0, 8], [0, 1]
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
            [2, 1], [2, 0], [98, 0], [98, 1], [52, 19], [50, 20], [48, 19], [2, 1]
        ]);
    });
});
