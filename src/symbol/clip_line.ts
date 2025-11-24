import Point from '@mapbox/point-geometry';

/**
 * Returns the part of a multiline that intersects with the provided rectangular box.
 *
 * @param lines - the lines to check
 * @param x1 - the left edge of the box
 * @param y1 - the top edge of the box
 * @param x2 - the right edge of the box
 * @param y2 - the bottom edge of the box
 * @returns lines
 */
export function clipLine(lines: Array<Array<Point>>, x1: number, y1: number, x2: number, y2: number): Array<Array<Point>> {
    const clippedLines: Array<Array<Point>> = [];

    for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        let clippedLine: Point[] | undefined;

        for (let i = 0; i < line.length - 1; i++) {
            let p0 = line[i];
            let p1 = line[i + 1];

            if (p0.x < x1 && p1.x < x1) {
                continue;
            } else if (p0.x < x1) {
                p0 = new Point(x1, p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)))._round();
            } else if (p1.x < x1) {
                p1 = new Point(x1, p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)))._round();
            }

            if (p0.y < y1 && p1.y < y1) {
                continue;
            } else if (p0.y < y1) {
                p0 = new Point(p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y1)._round();
            } else if (p1.y < y1) {
                p1 = new Point(p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y1)._round();
            }

            if (p0.x >= x2 && p1.x >= x2) {
                continue;
            } else if (p0.x >= x2) {
                p0 = new Point(x2, p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)))._round();
            } else if (p1.x >= x2) {
                p1 = new Point(x2, p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)))._round();
            }

            if (p0.y >= y2 && p1.y >= y2) {
                continue;
            } else if (p0.y >= y2) {
                p0 = new Point(p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y2)._round();
            } else if (p1.y >= y2) {
                p1 = new Point(p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y2)._round();
            }

            if (!clippedLine || !p0.equals(clippedLine[clippedLine.length - 1])) {
                clippedLine = [p0];
                clippedLines.push(clippedLine);
            }

            clippedLine.push(p1);
        }
    }

    return clippedLines;
}

/**
 * Clips the geometry to the given bounds.
 * @param geometry - the geometry to clip
 * @param type - the geometry type (1=POINT, 2=LINESTRING, 3=POLYGON)
 * @param x1 - the left edge of the clipping box
 * @param y1 - the top edge of the clipping box
 * @param x2 - the right edge of the clipping box
 * @param y2 - the bottom edge of the clipping box
 * @returns the clipped geometry
 */
export function clipGeometry(geometry: Point[][], type: 0 | 1 | 2 | 3, x1: number, y1: number, x2: number, y2: number): Point[][] {
    let clippedGeometry = clipGeometryOnAxis(geometry, type, x1, x2, AxisType.X);
    clippedGeometry = clipGeometryOnAxis(clippedGeometry, type, y1, y2, AxisType.Y);
    return clippedGeometry;
}

/**
 * On which axis to clip
 */
const enum AxisType {
    X = 0,
    Y = 1
}

/**
 * Clip features between two vertical or horizontal axis-parallel lines:
 * ```
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *```
 * @param geometry - the geometry to clip
 * @param type - the geometry type (1=POINT, 2=LINESTRING, 3=POLYGON)
 * @param start - the start line coordinate (x or y) to clip against
 * @param end - the end line coordinate (x or y) to clip against
 * @param axis - the axis to clip on (X or Y)
 * @returns the clipped geometry
 */
function clipGeometryOnAxis(geometry: Point[][], type: 0 | 1 | 2 | 3, start: number, end: number, axis: AxisType): Point[][] {
    switch (type) {
        case 1: // POINT
            return clipPoints(geometry, start, end, axis);
        case 2: // LINESTRING
            return clipLines(geometry, start, end, axis, false);
        case 3: // POLYGON
            return clipLines(geometry, start, end, axis, true);
    }

    return [];
}

function clipPoints(geometry: Point[][], start: number, end: number, axis: AxisType): Point[][] {
    const newGeometry: Point[][] = [];
    for (const ring of geometry) {
        for (const point of ring) {
            const a = axis === AxisType.X ? point.x : point.y;
            if (a >= start && a <= end) {
                newGeometry.push([point]);
            }
        }
    }
    return newGeometry;
}

/**
 * Clips a line to the given start and end coordinates.
 * @param line - the line to clip
 * @param start - the start line coordinate (x or y) to clip against
 * @param end - the end line coordinate (x or y) to clip against
 * @param axis - the axis to clip on (X or Y)
 * @param isPolygon - whether the line is part of a polygon
 * @returns the clipped line(s)
 */
function clipLineInternal(line: Point[], start: number, end: number, axis: AxisType, isPolygon: boolean): Point[][] {
    const intersectionPoint = axis === AxisType.X ? intersectionPointX : intersectionPointY;

    let slice: Point[] = [];
    const newLine: Point[][] = [];
    for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i];
        const p2 = line[i + 1];
        const pos1 = axis === AxisType.X ? p1.x : p1.y;
        const pos2 = axis === AxisType.X ? p2.x : p2.y;
        let exited = false;

        if (pos1 < start) {
            // ---|-->  | (line enters the clip region from the left)
            if (pos2 > start) {
                slice.push(intersectionPoint(p1, p2, start));
            }
        } else if (pos1 > end) {
            // |  <--|--- (line enters the clip region from the right)
            if (pos2 < end) {
                slice.push(intersectionPoint(p1, p2, end));
            }
        } else {
            slice.push(p1);
        }
        if (pos2 < start && pos1 >= start) {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            slice.push(intersectionPoint(p1, p2, start));
            exited = true;
        }
        if (pos2 > end && pos1 <= end) {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            slice.push(intersectionPoint(p1, p2, end));
            exited = true;
        }

        if (!isPolygon && exited) {
            newLine.push(slice);
            slice = [];
        }
    }

    // add the last point
    const last = line.length - 1;
    const lastPos = axis === AxisType.X ? line[last].x : line[last].y;
    if (lastPos >= start && lastPos <= end) {
        slice.push(line[last]);
    }

    // close the polygon if its endpoints are not the same after clipping
    if (isPolygon && slice.length > 0 && !slice[0].equals(slice[slice.length - 1])) {
        slice.push(new Point(slice[0].x, slice[0].y));
    }
    if (slice.length > 0) {
        newLine.push(slice);
    }
    return newLine;
}

function clipLines(geometry: Point[][], start: number, end: number, axis: AxisType, isPolygon: boolean): Point[][] {
    const newGeometry: Point[][] = [];
    for (const line of geometry) {
        const clippedLines = clipLineInternal(line, start, end, axis, isPolygon);
        if (clippedLines.length > 0) {
            newGeometry.push(...clippedLines);
        }
    }
    return newGeometry;
}

function intersectionPointX(p1: Point, p2: Point, x: number): Point {
    const t = (x - p1.x) / (p2.x - p1.x);
    return new Point(x, p1.y + (p2.y - p1.y) * t);
}

function intersectionPointY(p1: Point, p2: Point, y: number): Point {
    const t = (y - p1.y) / (p2.y - p1.y);
    return new Point(p1.x + (p2.x - p1.x) * t, y);
}
