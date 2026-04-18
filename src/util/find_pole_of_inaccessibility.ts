import Queue from 'tinyqueue';

import Point from '@mapbox/point-geometry';
import {distToSegmentSquared} from './intersection_tests';
import {Bounds} from '../geo/bounds';

/**
 * Finds an approximation of a polygon's Pole Of Inaccessibility https://en.wikipedia.org/wiki/Pole_of_inaccessibility
 * This is a copy of https://github.com/mapbox/polylabel adapted to use Points
 *
 * @param polygonRings - first item in array is the outer ring followed optionally by the list of holes, should be an element of the result of util/classify_rings
 * @param precision - Specified in input coordinate units. If 0 returns after first run, if `> 0` repeatedly narrows the search space until the radius of the area searched for the best pole is less than precision
 * @returns Pole of Inaccessibility.
 */
export function findPoleOfInaccessibility(
    polygonRings: Point[][],
    precision: number = 1,
): Point {
    const bounds = Bounds.fromPoints(polygonRings[0]);

    const cellSize = Math.min(bounds.width(), bounds.height());
    let h = cellSize / 2;

    // a priority queue of cells in order of their "potential" (max distance to polygon)
    const cellQueue = new Queue([], compareMax);

    const {minX, minY, maxX, maxY} = bounds;
    if (cellSize === 0) return new Point(minX, minY);

    // cover polygon with initial cells
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            cellQueue.push(new Cell(x + h, y + h, h, polygonRings));
        }
    }

    // take centroid as the first best guess
    const centroidCell = getCentroidCell(polygonRings);
    let bestCell = centroidCell;

    while (cellQueue.length) {
        // pick the most promising cell from the queue
        const cell = cellQueue.pop();

        // update the best cell if we found a better one
        if (cell.d > bestCell.d || !bestCell.d) {
            bestCell = cell;
        }

        // do not drill down further if there's no chance of a better solution
        if (cell.max - bestCell.d <= precision) continue;

        // split the cell into four cells
        h = cell.h / 2;
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y + h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y + h, h, polygonRings));
    }

    // For convex or nearly-convex polygons, the centroid provides visually
    // better label placement than the mathematical POI.
    // Coordinate rounding (e.g. in geojson-vt) can break polygon symmetry and cause the POI to
    // drift far from center even though its distance-to-edge is only marginally better.
    // Prefer the centroid when it is inside the polygon
    // and its distance is within `precision` of the best found.
    if (centroidCell.d > 0 && bestCell.d - centroidCell.d <= precision) {
        return centroidCell.p;
    }
    return bestCell.p;
}

function compareMax(a: Cell, b: Cell) {
    return b.max - a.max;
}

class Cell {
    p: Point;
    h: number;
    d: number;
    max: number;

    constructor(x: number, y: number, h: number, polygon: Point[][]) {
        this.p = new Point(x, y);
        this.h = h; // half the cell size
        this.d = pointToPolygonDist(this.p, polygon); // distance from cell center to polygon
        this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
    }
}

// signed distance from point to polygon outline (negative if point is outside)
function pointToPolygonDist(p: Point, polygon: Point[][]) {
    let inside = false;
    let minDistSq = Infinity;

    for (const ring of polygon) {

        for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
            const a = ring[i];
            const b = ring[j];

            if ((a.y > p.y !== b.y > p.y) &&
                (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;

            minDistSq = Math.min(minDistSq, distToSegmentSquared(p, a, b));
        }
    }

    return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

// get polygon centroid
export function getCentroidCell(polygon: Point[][]) {
    let area = 0;
    let x = 0;
    let y = 0;
    const points = polygon[0];
    for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
        const a = points[i];
        const b = points[j];
        const f = a.x * b.y - b.x * a.y;
        x += (a.x + b.x) * f;
        y += (a.y + b.y) * f;
        area += f * 3;
    }
    return new Cell(x / area, y / area, 0, polygon);
}
