import {isCounterClockwise} from './util';

import Point from '@mapbox/point-geometry';

export {polygonIntersectsBufferedPoint, polygonIntersectsMultiPolygon, polygonIntersectsBufferedMultiLine, polygonIntersectsPolygon, distToSegmentSquared, polygonIntersectsBox};

type Line = Point[];
type MultiLine = Line[];
type Ring = Point[];
type Polygon = Point[];
type MultiPolygon = Polygon[];

function polygonIntersectsPolygon(polygonA: Polygon, polygonB: Polygon) {
    for (const point of polygonA) {
        if (polygonContainsPoint(polygonB, point)) return true;
    }

    for (const point of polygonB) {
        if (polygonContainsPoint(polygonA, point)) return true;
    }

    return lineIntersectsLine(polygonA, polygonB);
}

function polygonIntersectsBufferedPoint(polygon: Polygon, point: Point, radius: number) {
    if (polygonContainsPoint(polygon, point)) return true;
    return pointIntersectsBufferedLine(point, polygon, radius);
}

function polygonIntersectsMultiPolygon(polygon: Polygon, multiPolygon: MultiPolygon) {

    if (polygon.length === 1) {
        return multiPolygonContainsPoint(multiPolygon, polygon[0]);
    }

    for (const ring of multiPolygon) {
        for (const point of ring) {
            if (polygonContainsPoint(polygon, point)) return true;
        }
    }

    for (const point of polygon) {
        if (multiPolygonContainsPoint(multiPolygon, point)) return true;
    }

    for (const ring of multiPolygon) {
        if (lineIntersectsLine(polygon, ring)) return true;
    }

    return false;
}

function polygonIntersectsBufferedMultiLine(polygon: Polygon, multiLine: MultiLine, radius: number) {
    for (const line of multiLine) {

        if (polygon.length >= 3) {
            for (const point of line) {
                if (polygonContainsPoint(polygon, point)) return true;
            }
        }

        if (lineIntersectsBufferedLine(polygon, line, radius)) return true;
    }
    return false;
}

function lineIntersectsBufferedLine(lineA: Line, lineB: Line, radius: number) {

    if (lineA.length > 1) {
        if (lineIntersectsLine(lineA, lineB)) return true;

        // Check whether any point in either line is within radius of the other line
        for (const point of lineB) {
            if (pointIntersectsBufferedLine(point, lineA, radius)) return true;
        }
    }

    for (const point of lineA) {
        if (pointIntersectsBufferedLine(point, lineB, radius)) return true;
    }

    return false;
}

function lineIntersectsLine(lineA: Line, lineB: Line) {
    if (lineA.length === 0 || lineB.length === 0) return false;
    for (let i = 0; i < lineA.length - 1; i++) {
        const a0 = lineA[i];
        const a1 = lineA[i + 1];
        for (let j = 0; j < lineB.length - 1; j++) {
            const b0 = lineB[j];
            const b1 = lineB[j + 1];
            if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) return true;
        }
    }
    return false;
}

function lineSegmentIntersectsLineSegment(a0: Point, a1: Point, b0: Point, b1: Point) {
    return isCounterClockwise(a0, b0, b1) !== isCounterClockwise(a1, b0, b1) &&
        isCounterClockwise(a0, a1, b0) !== isCounterClockwise(a0, a1, b1);
}

function pointIntersectsBufferedLine(p: Point, line: Line, radius: number) {
    const radiusSquared = radius * radius;

    if (line.length === 1) return p.distSqr(line[0]) < radiusSquared;

    for (let i = 1; i < line.length; i++) {
        // Find line segments that have a distance <= radius^2 to p
        // In that case, we treat the line as "containing point p".
        const v = line[i - 1], w = line[i];
        if (distToSegmentSquared(p, v, w) < radiusSquared) return true;
    }
    return false;
}

// Code from https://stackoverflow.com/a/1501725/331379.
function distToSegmentSquared(p: Point, v: Point, w: Point) {
    const l2 = v.distSqr(w);
    if (l2 === 0) return p.distSqr(v);
    const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0) return p.distSqr(v);
    if (t > 1) return p.distSqr(w);
    return p.distSqr(w.sub(v)._mult(t)._add(v));
}

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings: Ring[], p: Point) {
    let c = false,
        ring, p1, p2;

    for (const currentRing of rings) {
        ring = currentRing;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            p1 = ring[i];
            p2 = ring[j];
            if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                c = !c;
            }
        }
    }
    return c;
}

function polygonContainsPoint(ring: Ring, p: Point) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const p1 = ring[i];
        const p2 = ring[j];
        if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            c = !c;
        }
    }
    return c;
}

function polygonIntersectsBox(ring: Ring, boxX1: number, boxY1: number, boxX2: number, boxY2: number) {
    for (const p of ring) {
        if (boxX1 <= p.x &&
            boxY1 <= p.y &&
            boxX2 >= p.x &&
            boxY2 >= p.y) return true;
    }

    const corners = [
        new Point(boxX1, boxY1),
        new Point(boxX1, boxY2),
        new Point(boxX2, boxY2),
        new Point(boxX2, boxY1)];

    if (ring.length > 2) {
        for (const corner of corners) {
            if (polygonContainsPoint(ring, corner)) return true;
        }
    }

    for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];
        if (edgeIntersectsBox(p1, p2, corners)) return true;
    }

    return false;
}

function edgeIntersectsBox(e1: Point, e2: Point, corners: Point[]) {
    const tl = corners[0];
    const br = corners[2];
    // the edge and box do not intersect in either the x or y dimensions
    if (((e1.x < tl.x) && (e2.x < tl.x)) ||
        ((e1.x > br.x) && (e2.x > br.x)) ||
        ((e1.y < tl.y) && (e2.y < tl.y)) ||
        ((e1.y > br.y) && (e2.y > br.y))) return false;

    // check if all corners of the box are on the same side of the edge
    const dir = isCounterClockwise(e1, e2, corners[0]);
    return dir !== isCounterClockwise(e1, e2, corners[1]) ||
        dir !== isCounterClockwise(e1, e2, corners[2]) ||
        dir !== isCounterClockwise(e1, e2, corners[3]);
}
