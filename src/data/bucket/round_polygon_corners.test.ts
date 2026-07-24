import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {roundPolygonCorners} from './round_polygon_corners.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';

function round(p: Point):GeoJSON.Position {
    const x = Math.round(p.x * 100) / 100;
    const y = Math.round(p.y * 100) / 100;
    return [x, y];
}

function fc(coordinates: GeoJSON.Position[]): GeoJSON.FeatureCollection {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'Polygon',
                    coordinates: [coordinates]
                }
            }
        ]
    };
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
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ]];

        const output = roundPolygonCorners(input, 10, canonical);
        const points = output[0].map(round);

        expect(points.length).toBe(19);
        expect(JSON.stringify(fc(points))).toBe('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,2],[0.27,1],[1,0.27],[2,0],[8,0],[8.77,0.15],[9.41,0.59],[9.85,1.23],[10,2],[10,8],[9.73,9],[9,9.73],[8,10],[2,10],[1.23,9.85],[0.59,9.41],[0.15,8.77],[0,8],[0,2]]]}}]}');
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
        expect(JSON.stringify(fc(points))).toBe('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,2],[0.27,1],[1,0.27],[2,0],[8,0],[8.77,0.15],[9.41,0.59],[9.85,1.23],[10,2],[10,8],[9.73,9],[9,9.73],[8,10],[2,10],[1.23,9.85],[0.59,9.41],[0.15,8.77],[0,8],[0,2]]]}}]}');
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
        expect(JSON.stringify(fc(points))).toBe('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,0.08],[0.01,0.04],[0.04,0.01],[0.08,0],[100,0],[0.08,0.4],[0.05,0.39],[0.02,0.38],[0.01,0.35],[0,0.32],[0,0.08]]]}}]}');
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

        expect(points.length).toBe(20);
        expect(JSON.stringify(fc(points))).toBe('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,1],[0.13,0.5],[0.5,0.13],[1,0],[5,0],[9,0],[9.38,0.08],[9.71,0.29],[9.92,0.62],[10,1],[10,8],[9.73,9],[9,9.73],[8,10],[2,10],[1.23,9.85],[0.59,9.41],[0.15,8.77],[0,8],[0,1]]]}}]}');
    });
});
