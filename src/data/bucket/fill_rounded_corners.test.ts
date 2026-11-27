import {describe, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {cornersAlongOutline, cornersReachingTriangles, findRoundableCorners, MAX_CORNERS_PER_TRIANGLE, roundedFillTriangles, type TriangleMesh} from './fill_rounded_corners.ts';

function ring(...coordinates: Array<[number, number]>): Point[] {
    return coordinates.map(([x, y]) => new Point(x, y));
}

function flatten(points: Point[]): number[] {
    return points.flatMap(p => [p.x, p.y]);
}

function cornersOfTriangle(assignment: Int32Array, triangle: number): number[] {
    return Array.from(assignment.subarray(triangle * MAX_CORNERS_PER_TRIANGLE, (triangle + 1) * MAX_CORNERS_PER_TRIANGLE))
        .filter(c => c !== -1)
        .sort((a, b) => a - b);
}

function triangleOfRing(fillIn: Point[]): TriangleMesh {
    return {verticesFlattened: flatten(fillIn.slice(0, 3)), indicesTriangles: [0, 1, 2]};
}

function square(): Point[] {
    return ring([0, 0], [100, 0], [100, 100], [0, 100], [0, 0]);
}

describe('findRoundableCorners', () => {
    test('marks every corner of a rectangle convex, with half its shorter edge to cut', () => {
        const corners = findRoundableCorners([ring([0, 0], [100, 0], [100, 40], [0, 40], [0, 0])]);

        expect(corners.map(c => [c.point.x, c.point.y, c.convex, c.maxCutDistance])).toEqual([
            [0, 0, true, 20],
            [100, 0, true, 20],
            [100, 40, true, 20],
            [0, 40, true, 20]
        ]);
    });

    test('judges convexity the same whichever way the ring winds', () => {
        const corners = findRoundableCorners([ring([0, 0], [0, 40], [100, 40], [100, 0], [0, 0])]);

        expect(corners.map(c => c.convex)).toEqual([true, true, true, true]);
    });

    test('marks the reflex vertex of an L shape concave', () => {
        const corners = findRoundableCorners([ring([0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100], [0, 0])]);

        expect(corners.map(c => [c.point.x, c.point.y, c.convex])).toEqual([
            [0, 0, true],
            [100, 0, true],
            [100, 50, true],
            [50, 50, false],
            [50, 100, true],
            [0, 100, true]
        ]);
    });

    test('marks the corners of a hole concave', () => {
        const hole = ring([25, 25], [25, 75], [75, 75], [75, 25], [25, 25]);

        const corners = findRoundableCorners([square(), hole]);

        expect(corners.slice(4).map(c => c.convex)).toEqual([false, false, false, false]);
    });

    test('leaves corners on a tile clip line sharp', () => {
        const corners = findRoundableCorners([ring([-64, 0], [100, 0], [100, 100], [-64, 100], [-64, 0])]);

        expect(corners.map(c => [c.point.x, c.point.y])).toEqual([[100, 0], [100, 100]]);
    });

    test('skips vertices where the ring runs straight on or doubles back', () => {
        const corners = findRoundableCorners([ring([0, 0], [50, 0], [100, 0], [100, 40], [200, 41], [100, 42], [100, 100], [0, 100], [0, 0])]);

        expect(corners.map(c => [c.point.x, c.point.y])).toEqual([[0, 0], [100, 0], [100, 40], [100, 42], [100, 100], [0, 100]]);
    });

    test('takes the neighbours of a corner from distinct vertices', () => {
        const corners = findRoundableCorners([ring([0, 0], [100, 0], [100, 0], [100, 100], [0, 100], [0, 0])]);

        expect(corners).toHaveLength(4);
        expect(corners[1].prev).toEqual(new Point(0, 0));
        expect(corners[1].next).toEqual(new Point(100, 100));
    });
});

describe('cornersReachingTriangles', () => {
    test('gives each triangle the convex corners whose cut overlaps it', () => {
        const corners = findRoundableCorners([square()]);

        const assignment = cornersReachingTriangles(corners, flatten(square()), [0, 1, 2, 2, 3, 0]);

        expect(cornersOfTriangle(assignment, 0)).toEqual([0, 1, 2]);
        expect(cornersOfTriangle(assignment, 1)).toEqual([0, 2, 3]);
    });

    test('reaches a triangle that does not share the corner', () => {
        const corners = findRoundableCorners([square()]);

        const assignment = cornersReachingTriangles(corners, [0, 0, 80, 0, 0, 80], [0, 1, 2]);

        expect(cornersOfTriangle(assignment, 0)).toEqual([0, 1, 3]);
    });

    test('does not assign concave corners', () => {
        const corners = findRoundableCorners([ring([0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100], [0, 0])]);

        const assignment = cornersReachingTriangles(corners, [20, 20, 60, 40, 40, 60], [0, 1, 2]);

        expect(cornersOfTriangle(assignment, 0)).toEqual([0]);
    });

    test('keeps the corners nearest the centroid when more reach a triangle than it holds', () => {
        const corners = findRoundableCorners([square()]);

        const assignment = cornersReachingTriangles(corners, [-10, -10, 300, -10, -10, 300], [0, 1, 2]);

        expect(cornersOfTriangle(assignment, 0)).toEqual([1, 2, 3]);
    });

    test('leaves triangles that no cut reaches without corners', () => {
        const corners = findRoundableCorners([square()]);
        const triangle = [40, 40, 60, 40, 40, 60];

        expect(cornersOfTriangle(cornersReachingTriangles(corners, triangle, [0, 1, 2]), 0)).toEqual([]);
        expect(cornersOfTriangle(cornersReachingTriangles([], triangle, [0, 1, 2]), 0)).toEqual([]);
    });
});

describe('roundedFillTriangles', () => {
    test('gives every mesh triangle vertices of its own and the corners that reach it', () => {
        const corners = findRoundableCorners([square()]);

        const fill = roundedFillTriangles(corners, {verticesFlattened: flatten(square()), indicesTriangles: [0, 1, 2, 2, 3, 0]}, triangleOfRing);

        expect(fill.vertices).toEqual([0, 0, 100, 0, 100, 100, 100, 100, 0, 100, 0, 0]);
        expect(cornersOfTriangle(fill.corners, 0)).toEqual([0, 1, 2]);
        expect(cornersOfTriangle(fill.corners, 1)).toEqual([0, 2, 3]);
        expect(fill.addsArea).toEqual([false, false]);
    });

    test('fills a concave corner with every triangle its ring is triangulated into, each rounded by that corner', () => {
        const corners = findRoundableCorners([ring([0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100], [0, 0])]);
        const triangulate = vi.fn((fillIn: Point[]) => ({
            verticesFlattened: [...flatten(fillIn.slice(0, 3)), 75, 75],
            indicesTriangles: [0, 1, 3, 1, 2, 3]
        }));

        const fill = roundedFillTriangles(corners, {verticesFlattened: [], indicesTriangles: []}, triangulate);

        expect(triangulate).toHaveBeenCalledWith(ring([100, 50], [50, 50], [50, 100], [100, 50]));
        expect(fill.vertices).toEqual([100, 50, 50, 50, 75, 75, 50, 50, 50, 100, 75, 75]);
        expect([0, 1].map(t => cornersOfTriangle(fill.corners, t))).toEqual([[3], [3]]);
        expect(fill.addsArea).toEqual([true, true]);
    });
});

describe('cornersAlongOutline', () => {
    test('gives each segment of an outline the corners at its ends', () => {
        const corners = findRoundableCorners([square()]);

        const assignment = cornersAlongOutline(corners, flatten(square()), [0, 1, 1, 2, 2, 3, 3, 0]);

        expect([0, 1, 2, 3].map(s => cornersOfTriangle(assignment, s))).toEqual([[0, 1], [1, 2], [2, 3], [0, 3]]);
    });

    test('gives a segment of a subdivided edge the corners whose arcs can reach it', () => {
        const corners = findRoundableCorners([square()]);
        const edge = [0, 0, 25, 0, 50, 0, 75, 0, 100, 0];

        const assignment = cornersAlongOutline(corners, edge, [0, 1, 1, 2, 2, 3, 3, 4]);

        expect([0, 1, 2, 3].map(s => cornersOfTriangle(assignment, s))).toEqual([[0], [0], [1], [1]]);
    });

    test('leaves out a segment that only passes close to a corner', () => {
        const corners = findRoundableCorners([square()]);

        const assignment = cornersAlongOutline(corners, [0, 5, 40, 5], [0, 1]);

        expect(cornersOfTriangle(assignment, 0)).toEqual([]);
    });
});
