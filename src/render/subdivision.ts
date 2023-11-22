import {EXTENT, EXTENT_SUBDIVISION_BORDER} from '../data/extent';
import {webMercatorToSpherePoint} from '../geo/mercator_coordinate';
import {CanonicalTileID} from '../source/tile_id';

type SubdivisionResult = {
    verticesFlattened: Array<number>;
    indicesTriangles: Array<number>;
    indicesLineList: Array<Array<number>>;
};

// Point p1 is the tested point, points p2 and p3 are the triangle edge.
// Computes the cross product of vectors p3->p1 and p3->p2, its sign tells us on what side of the
// line defined by p2 and p3 lies the point p1.
function sign(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): number {
    return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
}

function cross(ax: number, ay: number, bx: number, by: number): number {
    return ax * by - ay * bx;
}

// Adapted from: https://stackoverflow.com/a/2049593
function pointInTriangle(pointX: number, pointY: number, triangleVertices: Array<number>): boolean {
    const d1 = sign(pointX, pointY, triangleVertices[0], triangleVertices[1], triangleVertices[2], triangleVertices[3]);
    const d2 = sign(pointX, pointY, triangleVertices[2], triangleVertices[3], triangleVertices[4], triangleVertices[5]);
    const d3 = sign(pointX, pointY, triangleVertices[4], triangleVertices[5], triangleVertices[0], triangleVertices[1]);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
}

function addUnique<T>(array: Array<T>, element: T): void {
    if (!array.includes(element)) {
        array.push(element);
    }
}

/**
 * Linear interpolation between `a` and `b`, same as the GLSL function `mix`.
 */
function lerp(a: number, b: number, mix: number): number {
    return a * (1.0 - mix) + b * mix;
}

function vectorLength(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
}

/**
 * Angle in radians of this vector from the negativy Y axis clockwise (assuming X=right, Y=down).
 */
function angle(x: number, y: number): number {
    const len = vectorLength(x, y);
    const ny = y / len;
    if (x >= 0) {
        return Math.acos(-ny);
    } else {
        return Math.PI * 2.0 - Math.acos(-ny);
    }
}

/**
 * Check whether an edge can be divided by a line parallel to the Y axis, return the X coordinate of the division point if yes.
 * @param e0x - Edge vertex 0 x.
 * @param e0y - Edge vertex 0 y.
 * @param e1x - Edge vertex 1 x.
 * @param e1y - Edge vertex 1 y.
 * @param divideX - Division line X coordinate.
 * @returns Either the Y coordinate of the intersection of the edge and division line, or undefined if the division line doesn't intersect the triangle.
 */
function checkEdgeDivide(e0x: number, e0y: number, e1x: number, e1y: number, divideX: number): number | undefined {
    // Do nothing if the edge is parallel to the divide axis (Y)
    if (e0x === e1x) {
        return undefined;
    }
    // Do nothing if divideX is outside bounds defined by e0x and e1x
    if ((e0x < e1x && (divideX <= e0x || e1x <= divideX)) || (e0x > e1x && (divideX <= e1x || e0x <= divideX))) {
        return undefined;
    }
    const divideY = lerp(e0y, e1y, (divideX - e0x) / (e1x - e0x));
    return Math.round(divideY);
}

// Special pole vertices have coordinates -32768,-32768 for the north pole and 32767,32767 for the south pole.
// First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
const NORTH_POLE_XY = -32768;
const SOUTH_POLE_XY = 32767;

class Subdivider {
    /**
     * Flattened vertex positions (xyxyxy).
     */
    private _finalVertices: Array<number>;
    /**
     * Map of "vertex x and y coordinate" to "index of such vertex".
     */
    private _vertexDictionary: {[_: string]: number};

    private readonly _granuality;
    private readonly _granualityStep;

    constructor(granuality: number) {
        this._granuality = granuality;
        this._granualityStep = EXTENT / granuality;
    }

    private getKey(x: number, y: number): string {
        return `${Math.floor(x).toString(36)}_${Math.floor(y).toString(36)}`;
    }

    private getVertexIndex(x: number, y: number): number {
        const key = this.getKey(x, y);
        if (key in this._vertexDictionary) {
            return this._vertexDictionary[key];
        }
        const index = this._finalVertices.length / 2;
        this._vertexDictionary[key] = index;
        this._finalVertices.push(x);
        this._finalVertices.push(y);
        return index;
    }

    private checkEdgeSubdivisionX(indicesInsideCell: Array<number>, e0x: number, e0y: number, e1x: number, e1y: number, divideX: number, boundMin: number, boundMax: number): void {
        const y = checkEdgeDivide(e0x, e0y, e1x, e1y, divideX);
        if (y !== undefined && y >= boundMin && y <= boundMax) {
            addUnique(indicesInsideCell, this.getVertexIndex(divideX, y));
        }
    }

    private checkEdgeSubdivisionY(indicesInsideCell: Array<number>, e0x: number, e0y: number, e1x: number, e1y: number, divideY: number, boundMin: number, boundMax: number): void {
        const x = checkEdgeDivide(e0y, e0x, e1y, e1x, divideY); // reuse checkEdgeDivide that only checks division line parallel to Y by swaping x and y in edge coordinates
        if (x !== undefined && x >= boundMin && x <= boundMax) {
            addUnique(indicesInsideCell, this.getVertexIndex(x, divideY));
        }
    }

    private subdivideTriangles(triangleIndices: Array<number>): Array<number> {
        if (!triangleIndices) {
            return [];
        }

        const finalTriangleIndices = [];

        // Iterate over all input triangles
        for (let primitiveIndex = 0; primitiveIndex < triangleIndices.length; primitiveIndex += 3) {
            const triangle = [
                triangleIndices[primitiveIndex + 0], // v0
                triangleIndices[primitiveIndex + 1], // v1
                triangleIndices[primitiveIndex + 2], // v2
            ];

            const triangleVertices = [
                this._finalVertices[triangleIndices[primitiveIndex + 0] * 2 + 0], // v0.x
                this._finalVertices[triangleIndices[primitiveIndex + 0] * 2 + 1], // v0.y
                this._finalVertices[triangleIndices[primitiveIndex + 1] * 2 + 0], // v1.x
                this._finalVertices[triangleIndices[primitiveIndex + 1] * 2 + 1], // v1.y
                this._finalVertices[triangleIndices[primitiveIndex + 2] * 2 + 0], // v2.x
                this._finalVertices[triangleIndices[primitiveIndex + 2] * 2 + 1], // v2.y
            ];

            // Get triangle AABB
            const minX = Math.min(triangleVertices[0], triangleVertices[2], triangleVertices[4]);
            const maxX = Math.max(triangleVertices[0], triangleVertices[2], triangleVertices[4]);
            const minY = Math.min(triangleVertices[1], triangleVertices[3], triangleVertices[5]);
            const maxY = Math.max(triangleVertices[1], triangleVertices[3], triangleVertices[5]);

            // Compute the relevant cell range so that only the cells inside the actual tile + border are covered
            const borderCells = Math.floor((EXTENT_SUBDIVISION_BORDER + this._granualityStep - 1) / this._granualityStep);
            const cellRangeXmin = Math.max(Math.floor(minX / this._granualityStep), -borderCells);
            const cellRangeYmin = Math.max(Math.floor(minY / this._granualityStep), -borderCells);
            const cellRangeXmax = Math.min(Math.floor((maxX - 1) / this._granualityStep), this._granuality - 1 + borderCells);
            const cellRangeYmax = Math.min(Math.floor((maxY - 1) / this._granualityStep), this._granuality - 1 + borderCells);

            // Iterate over all the "granuality grid" cells that might intersect this triangle
            for (let cellX = cellRangeXmin; cellX <= cellRangeXmax; cellX += 1) {
                for (let cellY = cellRangeYmin; cellY <= cellRangeYmax; cellY += 1) {
                    // Cell AABB
                    const cellMinX = cellX * this._granualityStep;
                    const cellMinY = cellY * this._granualityStep;
                    const cellMaxX = (cellX + 1) * this._granualityStep;
                    const cellMaxY = (cellY + 1) * this._granualityStep;

                    // Find all vertices (and their indices) that are inside this cell.
                    const indicesInsideCell = [];

                    // Check all original triangle vertices
                    if (triangleVertices[0] >= cellMinX && triangleVertices[0] <= cellMaxX &&
                    triangleVertices[1] >= cellMinY && triangleVertices[1] <= cellMaxY) {
                        addUnique(indicesInsideCell, triangle[0]);
                    }
                    if (triangleVertices[2] >= cellMinX && triangleVertices[2] <= cellMaxX &&
                    triangleVertices[3] >= cellMinY && triangleVertices[3] <= cellMaxY) {
                        addUnique(indicesInsideCell, triangle[1]);
                    }
                    if (triangleVertices[4] >= cellMinX && triangleVertices[4] <= cellMaxX &&
                    triangleVertices[5] >= cellMinY && triangleVertices[5] <= cellMaxY) {
                        addUnique(indicesInsideCell, triangle[2]);
                    }

                    // Check all cell edge vertices
                    if (pointInTriangle(cellMinX, cellMinY, triangleVertices)) {
                        addUnique(indicesInsideCell, this.getVertexIndex(cellMinX, cellMinY));
                    }
                    if (pointInTriangle(cellMaxX, cellMinY, triangleVertices)) {
                        addUnique(indicesInsideCell, this.getVertexIndex(cellMaxX, cellMinY));
                    }
                    if (pointInTriangle(cellMinX, cellMaxY, triangleVertices)) {
                        addUnique(indicesInsideCell, this.getVertexIndex(cellMinX, cellMaxY));
                    }
                    if (pointInTriangle(cellMaxX, cellMaxY, triangleVertices)) {
                        addUnique(indicesInsideCell, this.getVertexIndex(cellMaxX, cellMaxY));
                    }

                    // Check all intersections between triangle edges and cell edges
                    for (let edge = 0; edge < 3; edge++) {
                        const e0x = triangleVertices[(edge % 3) * 2 + 0];
                        const e0y = triangleVertices[(edge % 3) * 2 + 1];
                        const e1x = triangleVertices[((edge + 1) % 3) * 2 + 0];
                        const e1y = triangleVertices[((edge + 1) % 3) * 2 + 1];
                        this.checkEdgeSubdivisionX(indicesInsideCell, e0x, e0y, e1x, e1y, cellMinX, cellMinY, cellMaxY);
                        this.checkEdgeSubdivisionX(indicesInsideCell, e0x, e0y, e1x, e1y, cellMaxX, cellMinY, cellMaxY);
                        this.checkEdgeSubdivisionY(indicesInsideCell, e0x, e0y, e1x, e1y, cellMinY, cellMinX, cellMaxX);
                        this.checkEdgeSubdivisionY(indicesInsideCell, e0x, e0y, e1x, e1y, cellMaxY, cellMinX, cellMaxX);
                    }

                    // Now, indicesInsideCell contains all the vertices this subdivided cell contains - but in arbitrary order!
                    // We will now order them clockwise, from there generating the triangles is simple.
                    // We take advantage of the fact that the shape we want to triangulate is convex, and thus the average of all its vertices is guaranteed to lie inside the shape.
                    // Thus we will simply order the vertices by their azimuth angle from the average point.

                    let avgX = 0;
                    let avgY = 0;

                    for (let i = 0; i < indicesInsideCell.length; i++) {
                        avgX += this._finalVertices[indicesInsideCell[i] * 2 + 0];
                        avgY += this._finalVertices[indicesInsideCell[i] * 2 + 1];
                    }

                    avgX /= indicesInsideCell.length;
                    avgY /= indicesInsideCell.length;

                    indicesInsideCell.sort((a: number, b: number) => {
                        const ax = this._finalVertices[a * 2 + 0] - avgX;
                        const ay = this._finalVertices[a * 2 + 1] - avgY;
                        const bx = this._finalVertices[b * 2 + 0] - avgX;
                        const by = this._finalVertices[b * 2 + 1] - avgY;
                        const angleA = angle(ax, ay);
                        const angleB = angle(bx, by);
                        if (angleA < angleB) {
                            return -1;
                        }
                        if (angleA > angleB) {
                            return 1;
                        }
                        return 0;
                    });

                    // Now we finally generate triangles
                    for (let i = 2; i < indicesInsideCell.length; i++) {
                        const ax = this._finalVertices[indicesInsideCell[i - 1] * 2 + 0] - this._finalVertices[indicesInsideCell[0] * 2 + 0];
                        const ay = this._finalVertices[indicesInsideCell[i - 1] * 2 + 1] - this._finalVertices[indicesInsideCell[0] * 2 + 1];
                        const bx = this._finalVertices[indicesInsideCell[i] * 2 + 0] - this._finalVertices[indicesInsideCell[0] * 2 + 0];
                        const by = this._finalVertices[indicesInsideCell[i] * 2 + 1] - this._finalVertices[indicesInsideCell[0] * 2 + 1];

                        const c = cross(ax, ay, bx, by);

                        // Skip degenerate (linear) triangles
                        if (c === 0 ||
                            (this._finalVertices[indicesInsideCell[0] * 2 + 0] === this._finalVertices[indicesInsideCell[i] * 2 + 0] && this._finalVertices[indicesInsideCell[0] * 2 + 0] === this._finalVertices[indicesInsideCell[i - 1] * 2 + 0]) ||
                            (this._finalVertices[indicesInsideCell[0] * 2 + 1] === this._finalVertices[indicesInsideCell[i] * 2 + 1] && this._finalVertices[indicesInsideCell[0] * 2 + 1] === this._finalVertices[indicesInsideCell[i - 1] * 2 + 1])) {
                            //continue;
                        }

                        // Ensure CCW order
                        if (c > 0) {
                            finalTriangleIndices.push(indicesInsideCell[0]);
                            finalTriangleIndices.push(indicesInsideCell[i]);
                            finalTriangleIndices.push(indicesInsideCell[i - 1]);
                        }

                        if (c < 0) {
                            finalTriangleIndices.push(indicesInsideCell[0]);
                            finalTriangleIndices.push(indicesInsideCell[i - 1]);
                            finalTriangleIndices.push(indicesInsideCell[i]);
                        }
                    }
                }
            }
        }

        return finalTriangleIndices;
    }

    private subdivideLines(lineIndices: Array<number>): Array<number> {
        if (!lineIndices) {
            return [];
        }

        // JP: TODO: adapt for subdivision with border

        const finalLineIndices = [];

        // Iterate over all input lines
        for (let primitiveIndex = 0; primitiveIndex < lineIndices.length; primitiveIndex += 2) {
            const lineIndex0 = lineIndices[primitiveIndex + 0];
            const lineIndex1 = lineIndices[primitiveIndex + 1];

            const lineVertex0x = this._finalVertices[lineIndex0 * 2 + 0];
            const lineVertex0y = this._finalVertices[lineIndex0 * 2 + 1];
            const lineVertex1x = this._finalVertices[lineIndex1 * 2 + 0];
            const lineVertex1y = this._finalVertices[lineIndex1 * 2 + 1];

            // Get line AABB
            const minX = Math.min(lineVertex0x, lineVertex1x);
            const maxX = Math.max(lineVertex0x, lineVertex1x);
            const minY = Math.min(lineVertex0y, lineVertex1y);
            const maxY = Math.max(lineVertex0y, lineVertex1y);

            const clampedMinX = Math.max(minX, 0);
            const clampedMaxX = Math.min(maxX, EXTENT);
            const clampedMinY = Math.max(minY, 0);
            const clampedMaxY = Math.min(maxY, EXTENT);

            const subdividedLineIndices = [];

            // Add original line vertices - but only if they lie within the tile, as for globe rendering
            // we need to rely on software clipping done here instead of stencil clipping.
            if (lineVertex0x >= 0 && lineVertex0x <= EXTENT && lineVertex0y >= 0 && lineVertex0y <= EXTENT) {
                subdividedLineIndices.push(lineIndex0);
            }
            if (lineVertex1x >= 0 && lineVertex1x <= EXTENT && lineVertex1y >= 0 && lineVertex1y <= EXTENT) {
                subdividedLineIndices.push(lineIndex1);
            }

            for (let cellX = Math.max(Math.floor((minX + this._granualityStep) / this._granualityStep), 0); cellX <= Math.min(Math.floor((maxX - 1) / this._granualityStep), this._granuality); cellX += 1) {
                const cellEdgeX = cellX * this._granualityStep;
                this.checkEdgeSubdivisionX(subdividedLineIndices, lineVertex0x, lineVertex0y, lineVertex1x, lineVertex1y, cellEdgeX, clampedMinX, clampedMaxX);
            }

            for (let cellY = Math.max(Math.floor((minY + this._granualityStep) / this._granualityStep), 0); cellY <= Math.min(Math.floor((maxY - 1) / this._granualityStep), this._granuality); cellY += 1) {
                const cellEdgeY = cellY * this._granualityStep;
                this.checkEdgeSubdivisionY(subdividedLineIndices, lineVertex0x, lineVertex0y, lineVertex1x, lineVertex1y, cellEdgeY, clampedMinY, clampedMaxY);
            }

            const edgeX = lineVertex1x - lineVertex0x;
            const edgeY = lineVertex1y - lineVertex0y;

            if (subdividedLineIndices.length < 2) {
                continue;
            }

            subdividedLineIndices.sort((a: number, b: number) => {
                const ax = this._finalVertices[a * 2 + 0] - lineVertex0x;
                const ay = this._finalVertices[a * 2 + 1] - lineVertex0y;
                const bx = this._finalVertices[b * 2 + 0] - lineVertex0x;
                const by = this._finalVertices[b * 2 + 1] - lineVertex0y;
                const aDist = ax * edgeX + ay * edgeY;
                const bDist = bx * edgeX + by * edgeY;
                if (aDist < bDist) {
                    return -1;
                }
                if (aDist > bDist) {
                    return 1;
                }
                return 0;
            });

            for (let i = 1; i < subdividedLineIndices.length; i++) {
                finalLineIndices.push(subdividedLineIndices[i - 1]);
                finalLineIndices.push(subdividedLineIndices[i]);
            }
        }

        return finalLineIndices;
    }

    private ensureNoPoleVertices() {
        const flattened = this._finalVertices;

        // Special pole vertices have coordinates -32768,-32768 for the north pole and 32767,32767 for the south pole.
        // First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
        const northXY = -32768;
        const southXY = 32767;

        for (let i = 0; i < flattened.length; i += 2) {
            const vx = flattened[i];
            const vy = flattened[i + 1];
            if (vx === northXY && vy === northXY) {
                // Move slightly down
                flattened[i + 1] = northXY + 1;
            }
            if (vx === southXY && vy === southXY) {
                // Move slightly down
                flattened[i + 1] = southXY - 1;
            }
        }
    }

    /**
     * Detects edges that border the north or south tile edge
     * and adds triangles that extend those edges to the poles.
     * Only run this function on tiles that border the poles.
     * Assumes that supplied geometry is clipped to the inclusive range of 0..EXTENT.
     * Mutates the supplies vertex and index arrays.
     * @param indices - Triangle indices. This array is appended with new primitives.
     * @param north - Whether to generate geometry for the north pole.
     * @param south - Whether to generate geometry for the south pole.
     */
    private fillPoles(indices: Array<number>, north: boolean, south: boolean): void {
        const flattened = this._finalVertices;

        const northEdge = 0;
        const southEdge = EXTENT;

        const numIndices = indices.length;
        for (let primitiveIndex = 2; primitiveIndex < numIndices; primitiveIndex += 3) {
            const i0 = indices[primitiveIndex - 2];
            const i1 = indices[primitiveIndex - 1];
            const i2 = indices[primitiveIndex];
            const v0y = flattened[i0 * 2 + 1];
            const v1y = flattened[i1 * 2 + 1];
            const v2y = flattened[i2 * 2 + 1];

            if (north) {
                if (v0y === northEdge && v1y === northEdge) {
                    indices.push(i0);
                    indices.push(i1);
                    indices.push(this.getVertexIndex(NORTH_POLE_XY, NORTH_POLE_XY));
                }
                if (v1y === northEdge && v2y === northEdge) {
                    indices.push(i1);
                    indices.push(i2);
                    indices.push(this.getVertexIndex(NORTH_POLE_XY, NORTH_POLE_XY));
                }
                if (v2y === northEdge && v0y === northEdge) {
                    indices.push(i2);
                    indices.push(i0);
                    indices.push(this.getVertexIndex(NORTH_POLE_XY, NORTH_POLE_XY));
                }
            }
            if (south) {
                if (v0y === southEdge && v1y === southEdge) {
                    indices.push(i0);
                    indices.push(i1);
                    indices.push(this.getVertexIndex(SOUTH_POLE_XY, SOUTH_POLE_XY));
                }
                if (v1y === southEdge && v2y === southEdge) {
                    indices.push(i1);
                    indices.push(i2);
                    indices.push(this.getVertexIndex(SOUTH_POLE_XY, SOUTH_POLE_XY));
                }
                if (v2y === southEdge && v0y === southEdge) {
                    indices.push(i2);
                    indices.push(i0);
                    indices.push(this.getVertexIndex(SOUTH_POLE_XY, SOUTH_POLE_XY));
                }
            }
        }
    }

    /**
     * Fixes axis-aligned T-joints in a triangle mesh. Appends new triangles to the supplied index array.
     * A T-joint is when three triangles meet in such a way that their edges form a "T" shape:
     * ```
     *         C
     *        / \
     *      /     \
     *    /         \
     *  /    tri1     \
     * A-------T-------B
     *  \      |      /
     *   \tri2 | tri3/
     *    \    |    /
     *     \   |   /
     *      \  |  /
     *       \ | /
     *        \|/
     *         D
     * ```
     * When a nontrivial projection is applied to such geometry, the vertex T might be projected
     * slightly (one pixel) off the line formed by vertices A and B, producing a visible gap at this line.
     * In other words, the line A-B does not match the lines A-T and T-B pixel-perfectly.
     * The solution is to add an additional triangle A-T-B that will fill this gap,
     * or to break up triangle 1 into triangles A-T-C and T-B-C, thus breaking up the line A-B.
     * This function does the former.
     * This function assumes that all axis-aligned "linear" triangles (when eg. the x coordinate of all vertices is the same) were removed first.
     * @param indices - Triangle indices. This array is appended with new primitives.
     */
    private fixTjoints(indices: Array<number>): void {
        const flattened = this._finalVertices;

        const indicesByXthenY = indices.toSorted((a, b) => {
            const ax = flattened[a * 2 + 0];
            const ay = flattened[a * 2 + 1];
            const bx = flattened[b * 2 + 0];
            const by = flattened[b * 2 + 1];
            if (ax === bx) {
                return ay - by;
            }
            return ax - bx;
        });
        const indicesByYthenX = indices.toSorted((a, b) => {
            const ax = flattened[a * 2 + 0];
            const ay = flattened[a * 2 + 1];
            const bx = flattened[b * 2 + 0];
            const by = flattened[b * 2 + 1];
            if (ay === by) {
                return ax - bx;
            }
            return ay - by;
        });

        // map of "vertex index" -> "index of this vertex in indicesByXthenY"
        const dictionaryByXthenY = {};
        for (let i = 0; i < indicesByXthenY.length; i++) {
            const index = indicesByXthenY[i];
            dictionaryByXthenY[index.toString(36)] = i;
        }
        const dictionaryByYthenX = {};
        for (let i = 0; i < indicesByYthenX.length; i++) {
            const index = indicesByYthenX[i];
            dictionaryByYthenX[index.toString(36)] = i;
        }

        // We assume that all "linear" triangles were removed first.
        // Cases for T-joints in X axis (dashes are edges, letters are vertices):
        //
        // A------C----D--B
        // A--------------B         <- T-joint detected (A-CD-B)
        //
        // A---------C------------D <- T-joint detected (C-B-D)
        // A--------------B         <- T-joint detected (A-C-B)
        //
        // A---C----D---------E     <- T-joint detected (D-B-E)
        // A--------------B         <- T-joint detected (A-CD-B)

        const numIndices = indices.length;

        function tryFixEdge(i0: number, i1: number, dict: {[_: string] : number}, orderedIndices: Array<number>) {
            const orderedIndex0 = dict[i0.toString(36)];
            const orderedIndex1 = dict[i1.toString(36)];

            const orderedMin = Math.min(orderedIndex0, orderedIndex1);
            const orderedMax = Math.max(orderedIndex0, orderedIndex1);

            // If there is no vertex between 0 and 1, zero iterations are done
            for (let i = orderedMin + 1; i < orderedMax; i++) {
                indices.push(orderedIndices[orderedMax]);
                indices.push(orderedIndices[i - 1]);
                indices.push(orderedIndices[i]);
            }
        }

        for (let primitiveIndex = 2; primitiveIndex < numIndices; primitiveIndex += 3) {
            const i0 = indices[primitiveIndex - 2];
            const i1 = indices[primitiveIndex - 1];
            const i2 = indices[primitiveIndex];
            const v0x = flattened[i0 * 2];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2];
            const v1y = flattened[i1 * 2 + 1];
            const v2x = flattened[i2 * 2];
            const v2y = flattened[i2 * 2 + 1];

            // for each triangle edge
            if (v0x === v1x) {
                tryFixEdge(i0, i1, dictionaryByXthenY, indicesByXthenY);
            }
            if (v1x === v2x) {
                tryFixEdge(i1, i2, dictionaryByXthenY, indicesByXthenY);
            }
            if (v2x === v0x) {
                tryFixEdge(i2, i0, dictionaryByXthenY, indicesByXthenY);
            }
            if (v0y === v1y) {
                tryFixEdge(i0, i1, dictionaryByYthenX, indicesByYthenX);
            }
            if (v1y === v2y) {
                tryFixEdge(i1, i2, dictionaryByYthenX, indicesByYthenX);
            }
            if (v2y === v0y) {
                tryFixEdge(i2, i0, dictionaryByYthenX, indicesByYthenX);
            }
        }
    }

    /**
     * Detects any polygons whose edge lies right at the left/right edge of the tile, and "expands" those polygons beyond the tile edge.
     * This function mainly fixes a thin hole artifact seen around New Zealand, where the mercator tiles wrap around on the X axis.
     * Some tile sources do not have proper border polygons for this edge, this fuction is used to address that.
     * The north/south mercator edge does not have this problem, because the geometry there doesn't need to wrap around seamlessly,
     * and fixed anyway by the pole polygons introduced elsewhere during subdivision.
     * This function mutates the supplied vertex and index buffers.
     * Assumes there are no axis-aligned linear triangles.
     * This function should be called before fixing T-joints.
     * @param flattened - Flattened vertex coordinates, xyxyxy. This array is appended with new vertices.
     * @param indices - Triangle indices. This array is appended with new primitives.
     * @param left - Whether to add border at the left (west) edge of the tile.
     * @param right  - Whether to add border at the right (east) edge of the tile.
     */
    private addPlaneEdgeBorders(indices: Array<number>, left: boolean, right: boolean): void {
        const flattened = this._finalVertices;
        const numIndices = indices.length;

        const borderAmount = EXTENT_SUBDIVISION_BORDER;

        const that = this;

        const toleranceExtent = 0;

        function expandEdgeLeft(i0: number, i1: number) {
            const v0x = flattened[i0 * 2 + 0];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2 + 0];
            const v1y = flattened[i1 * 2 + 1];

            if (v0x === v1x && v0x >= -toleranceExtent && v0x <= toleranceExtent) {
                const upperY = Math.min(v0y, v1y);
                const lowerY = Math.max(v0y, v1y);
                const upperIndex = (upperY === v0y) ? i0 : i1;
                const lowerIndex = (upperY === v0y) ? i1 : i0;

                const upper2 = that.getVertexIndex(-borderAmount, upperY);
                const lower2 = that.getVertexIndex(-borderAmount, lowerY);

                indices.push(lower2);
                indices.push(upperIndex);
                indices.push(upper2);
                indices.push(lower2);
                indices.push(lowerIndex);
                indices.push(upperIndex);
            }
        }

        function expandEdgeRight(i0: number, i1: number) {
            const v0x = flattened[i0 * 2 + 0];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2 + 0];
            const v1y = flattened[i1 * 2 + 1];

            if (v0x === v1x && v0x >= EXTENT - toleranceExtent && v0x <= EXTENT + toleranceExtent) {
                const upperY = Math.min(v0y, v1y);
                const lowerY = Math.max(v0y, v1y);
                const upperIndex = (upperY === v0y) ? i0 : i1;
                const lowerIndex = (upperY === v0y) ? i1 : i0;

                const upper2 = that.getVertexIndex(EXTENT + borderAmount, upperY);
                const lower2 = that.getVertexIndex(EXTENT + borderAmount, lowerY);

                indices.push(lower2);
                indices.push(upper2);
                indices.push(upperIndex);
                indices.push(lower2);
                indices.push(upperIndex);
                indices.push(lowerIndex);
            }
        }

        for (let primitiveIndex = 2; primitiveIndex < numIndices; primitiveIndex += 3) {
            const i0 = indices[primitiveIndex - 2];
            const i1 = indices[primitiveIndex - 1];
            const i2 = indices[primitiveIndex];
            const v0x = flattened[i0 * 2 + 0];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2 + 0];
            const v1y = flattened[i1 * 2 + 1];
            const v2x = flattened[i2 * 2 + 0];
            const v2y = flattened[i2 * 2 + 1];

            if (left) {
                expandEdgeLeft(i0, i1);
                expandEdgeLeft(i1, i2);
                expandEdgeLeft(i2, i0);
            }

            if (right) {
                expandEdgeRight(i0, i1);
                expandEdgeRight(i1, i2);
                expandEdgeRight(i2, i0);
            }
        }
    }

    /**
     * Subdivides an input mesh. Imagine a regular square grid with the target granuality overlaid over the mesh - this is the subdivision's result.
     * Assumes a mesh of tile features - vertex coordinates are integers, visible range where subdivision happens is 0..8191.
     * @param vertices - Input vertex buffer, flattened - two values per vertex (x, y).
     * @param indices - Input index buffer.
     * @param granuality - Target granuality. If less or equal to 1, the input buffers are returned without modification.
     * @returns Vertex and index buffers with subdivision applied.
     */
    public subdivide(vertices: Array<number>, triangleIndices: Array<number>, lineIndices: Array<Array<number>>, canonical: CanonicalTileID): SubdivisionResult {
        if (this._vertexDictionary) {
            console.error('Subdivider: multiple use not allowed.');
            return undefined;
        }

        // Initialize the vertex dictionary with input vertices since we will use all of them anyway
        this._finalVertices = [...vertices];
        this._vertexDictionary = {};
        for (let i = 0; i < vertices.length; i += 2) {
            const index = i / 2;
            const key = this.getKey(vertices[i], vertices[i + 1]);
            this._vertexDictionary[key] = index;
        }

        // Subdivide triangles
        const subdividedTriangles = this.subdivideTriangles(triangleIndices);
        // Subdivide lines
        const subdividedLines = [];
        for (const lines of lineIndices) {
            subdividedLines.push(this.subdivideLines(lines));
        }

        // Fix seams at east/west mercator edges
        const east = canonical.x === (1 << canonical.z) - 1;
        const west = canonical.x === 0;
        if (east || west) {
            this.addPlaneEdgeBorders(subdividedTriangles, west, east);
        }

        // Fix horizontal/vertical seams at T-joints
        this.fixTjoints(subdividedTriangles);

        // Ensure no vertex has the special value used for pole vertices
        this.ensureNoPoleVertices();

        // Add pole vertices if the tile is at north/south mercator edge
        let north = false;
        let south = false;
        if (canonical) {
            if (canonical.y === 0) {
                north = true;
            }
            if (canonical.y === (1 << canonical.z) - 1) {
                south = true;
            }
        }
        if (north || south) {
            this.fillPoles(subdividedTriangles, north, south);
        }

        return {
            verticesFlattened: this._finalVertices,
            indicesTriangles: subdividedTriangles,
            indicesLineList: subdividedLines,
        };
    }
}

export function subdivideFill(vertices: Array<number>, triangleIndices: Array<number>, lineIndices: Array<Array<number>>, canonical: CanonicalTileID, granuality: number): SubdivisionResult {
    // JP: TODO: handle 16bit indices overflow!
    const subdivider = new Subdivider(granuality);
    return subdivider.subdivide(vertices, triangleIndices, lineIndices, canonical);
}

export function generateWireframeFromTriangles(triangleIndices: Array<number>): Array<number> {
    const lineIndices = [];

    for (let i = 2; i < triangleIndices.length; i += 3) {
        const i0 = triangleIndices[i - 2];
        const i1 = triangleIndices[i - 1];
        const i2 = triangleIndices[i];

        lineIndices.push(i0);
        lineIndices.push(i1);
        lineIndices.push(i1);
        lineIndices.push(i2);
        lineIndices.push(i2);
        lineIndices.push(i0);
    }

    return lineIndices;
}
