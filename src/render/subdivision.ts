import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {CanonicalTileID} from '../source/tile_id';
import earcut from 'earcut';
import {register} from '../util/web_worker_transfer';
import {lerp} from '../util/util';

export class SubdivisionGranularityExpression {
    /**
     * A tile of zoom level 0 will be subdivided to this granularity level.
     * Each subsequent zoom level will have its granularity halved.
     */
    private readonly _baseZoomGranularity: number;

    /**
     * No tile will have granularity level smaller than this.
     */
    private readonly _minGranularity: number;

    constructor(baseZoomGranularity: number, minGranularity: number) {
        this._baseZoomGranularity = baseZoomGranularity;
        this._minGranularity = minGranularity;
    }

    public getGranularityForZoomLevel(zoomLevel: number): number {
        const divisor = 1 << zoomLevel;
        return Math.max(Math.floor(this._baseZoomGranularity / divisor), this._minGranularity, 0);
    }
}

export class SubdivisionGranularitySetting {
    /**
     * Granularity settings used for fill layer (both polygons and their anti-aliasing outlines).
     */
    public readonly fill;

    /**
     * Granularity used for the line layer.
     */
    public readonly line;

    /**
     * Granularity used for geometry covering the entire tile: stencil masks, raster tiles, etc.
     */
    public readonly tile;

    constructor(options: {
        fill: SubdivisionGranularityExpression;
        line: SubdivisionGranularityExpression;
        tile: SubdivisionGranularityExpression;
    }) {
        this.fill = options.fill;
        this.line = options.line;
        this.tile = options.tile;
    }
}

register('SubdivisionGranularityExpression', SubdivisionGranularityExpression);
register('SubdivisionGranularitySetting', SubdivisionGranularitySetting);

export const subdivisionGranularitySettingsNoSubdivision = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(1, 1),
    line: new SubdivisionGranularityExpression(1, 1),
    tile: new SubdivisionGranularityExpression(1, 1),
});

type SubdivisionResult = {
    verticesFlattened: Array<number>;
    indicesTriangles: Array<number>;
    indicesLineList: Array<Array<number>>;
};

function addUnique<T>(array: Array<T>, element: T): void {
    if (!array.includes(element)) {
        array.push(element);
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
const NORTH_POLE_Y = -32768;
const SOUTH_POLE_Y = 32767;

class Subdivider {
    /**
     * Flattened vertex positions (xyxyxy).
     */
    private _finalVertices: Array<number>;

    /**
     * Map of "vertex x and y coordinate" to "index of such vertex".
     */
    private _vertexDictionary: Map<number, number>;

    private readonly _canonical: CanonicalTileID;

    private readonly _granuality;
    private readonly _granualityCellSize;

    constructor(granuality: number, canonical: CanonicalTileID) {
        this._granuality = granuality;
        this._granualityCellSize = EXTENT / granuality;
        this._canonical = canonical;
    }

    private getKey(x: number, y: number) {
        x = x + 32768;
        y = y + 32768;
        return (x << 16) | (y << 0);
    }

    private getVertexIndex(x: number, y: number): number {
        const xInt = Math.round(x) | 0;
        const yInt = Math.round(y) | 0;
        const key = this.getKey(xInt, yInt);
        if (this._vertexDictionary.has(key)) {
            return this._vertexDictionary.get(key);
        }
        const index = this._finalVertices.length / 2;
        this._vertexDictionary.set(key, index);
        this._finalVertices.push(xInt, yInt);
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

    private subdivideTrianglesScanline(inputIndices: Array<number>): Array<number> {
        if (this._granuality < 2) {
            return inputIndices;
        }

        const finalIndices = [];

        // Iterate over all input triangles
        const numIndices = inputIndices.length;
        for (let primitiveIndex = 0; primitiveIndex < numIndices; primitiveIndex += 3) {
            const triangleIndices = [
                inputIndices[primitiveIndex + 0], // v0
                inputIndices[primitiveIndex + 1], // v1
                inputIndices[primitiveIndex + 2], // v2
            ];

            const triangleVertices = [
                this._finalVertices[inputIndices[primitiveIndex + 0] * 2 + 0], // v0.x
                this._finalVertices[inputIndices[primitiveIndex + 0] * 2 + 1], // v0.y
                this._finalVertices[inputIndices[primitiveIndex + 1] * 2 + 0], // v1.x
                this._finalVertices[inputIndices[primitiveIndex + 1] * 2 + 1], // v1.y
                this._finalVertices[inputIndices[primitiveIndex + 2] * 2 + 0], // v2.x
                this._finalVertices[inputIndices[primitiveIndex + 2] * 2 + 1], // v2.y
            ];

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            // Compute AABB
            for (let i = 0; i < 3; i++) {
                const vx = triangleVertices[i * 2];
                const vy = triangleVertices[i * 2 + 1];
                minX = Math.min(minX, vx);
                maxX = Math.max(maxX, vx);
                minY = Math.min(minY, vy);
                maxY = Math.max(maxY, vy);
            }

            if (minX === maxX || minY === maxY) {
                continue; // Skip degenerate linear axis-aligned triangles
            }

            const cellXmin = Math.floor(minX / this._granualityCellSize);
            const cellXmax = Math.ceil(maxX / this._granualityCellSize);
            const cellYmin = Math.floor(minY / this._granualityCellSize);
            const cellYmax = Math.ceil(maxY / this._granualityCellSize);

            // Skip trinagles that do not span multiple cells
            if (cellXmin === cellXmax && cellYmin === cellYmax) {
                finalIndices.push(...triangleIndices);
                continue;
            }

            // Iterate over cell rows that intersect this triangle
            for (let cellRow = cellYmin; cellRow < cellYmax; cellRow++) {
                const cellRowYTop = cellRow * this._granualityCellSize;
                const cellRowYBottom = cellRowYTop + this._granualityCellSize;
                const ring = [];

                let leftmostIndex = 0;
                let leftmostX = Infinity;

                // Generate the vertex ring
                for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
                    // Current edge that will be subdivided: a --> b
                    // The remaining vertex of the triangle: c
                    const aX = triangleVertices[edgeIndex * 2];
                    const aY = triangleVertices[edgeIndex * 2 + 1];
                    const bX = triangleVertices[((edgeIndex + 1) * 2) % 6];
                    const bY = triangleVertices[((edgeIndex + 1) * 2 + 1) % 6];
                    const cX = triangleVertices[((edgeIndex + 2) * 2) % 6];
                    const cY = triangleVertices[((edgeIndex + 2) * 2 + 1) % 6];
                    // Edge direction
                    const dirX = bX - aX;
                    const dirY = bY - aY;

                    // Edges parallel with either axis will need special handling later.
                    const isParallelY = dirX === 0;
                    const isParallelX = dirY === 0;

                    // Distance along edge where it enters/exits current cell row
                    const tTop = (cellRowYTop - aY) / dirY;
                    const tBottom = (cellRowYBottom - aY) / dirY;
                    const tEnter = Math.min(tTop, tBottom);
                    const tExit = Math.max(tTop, tBottom);

                    // Determine if edge lies entirely outside this cell row.
                    // Check entry and exit points, or if edge is parallel with X, check its Y coordinate.
                    if ((!isParallelX && (tEnter >= 1 || tExit <= 0)) ||
                        (isParallelX && (aY < cellRowYTop || aY > cellRowYBottom))) {
                        // Skip this edge
                        // But make sure to add its endpoint vertex if needed.
                        if (bY >= cellRowYTop && bY <= cellRowYBottom) {
                            // The edge endpoint is withing this row, add it to the ring
                            if (bX < leftmostX) {
                                leftmostX = bX;
                                leftmostIndex = ring.length;
                            }
                            ring.push(triangleIndices[(edgeIndex + 1) % 3]);
                        }
                        continue;
                    }

                    // Do not add original triangle vertices now, those are handled separately later

                    // Special case: edge vertex for entry into cell row
                    // If edge is parallel with X axis, there is no entry vertex
                    if (!isParallelX && tEnter > 0) {
                        const x = aX + dirX * tEnter;
                        const y = aY + dirY * tEnter;
                        if (x < leftmostX) {
                            leftmostX = x;
                            leftmostIndex = ring.length;
                        }
                        ring.push(this.getVertexIndex(x, y));
                    }

                    const enterX = aX + dirX * Math.max(tEnter, 0);
                    const exitX = aX + dirX * Math.min(tExit, 1);
                    const leftX = isParallelX ? Math.min(aX, bX) : Math.min(enterX, exitX);
                    const rightX = isParallelX ? Math.max(aX, bX) : Math.max(enterX, exitX);

                    // No need to subdivide (along X) edges that are parallel with Y
                    if (!isParallelY) {
                        // Generate edge interior vertices
                        const edgeSubdivisionLeftCellX = Math.floor(leftX / this._granualityCellSize) + 1;
                        const edgeSubdivisionRightCellX = Math.ceil(rightX / this._granualityCellSize) - 1;

                        const isEdgeLeftToRight = isParallelX ? (aX < bX) : (enterX < exitX);
                        if (isEdgeLeftToRight) {
                            // Left to right
                            for (let cellX = edgeSubdivisionLeftCellX; cellX <= edgeSubdivisionRightCellX; cellX++) {
                                const x = cellX * this._granualityCellSize;
                                const y = aY + dirY * (x - aX) / dirX;
                                ring.push(this.getVertexIndex(x, y));
                            }
                        } else {
                            // Right to left
                            for (let cellX = edgeSubdivisionRightCellX; cellX >= edgeSubdivisionLeftCellX; cellX--) {
                                const x = cellX * this._granualityCellSize;
                                const y = aY + dirY * (x - aX) / dirX;
                                ring.push(this.getVertexIndex(x, y));
                            }
                        }
                    }

                    // Special case: edge vertex for exit from cell row
                    if (!isParallelX && tExit < 1) {
                        const x = aX + dirX * tExit;
                        const y = aY + dirY * tExit;
                        if (x < leftmostX) {
                            leftmostX = x;
                            leftmostIndex = ring.length;
                        }
                        ring.push(this.getVertexIndex(x, y));
                    }

                    // When to split inter-edge boundary segments?
                    // When the boundary doesn't intersect a vertex, its easy. But what if it does?

                    //      a
                    //     /|
                    //    / |
                    // --c--|--boundary
                    //    \ |
                    //     \|
                    //      b
                    //
                    // Inter-edge region should be generated when processing the a-b edge.
                    // This happens fine for the top row, for the bottom row,
                    //

                    //      x
                    //     /|
                    //    / |
                    // --x--x--boundary
                    //
                    // Edge that lies on boundary should be subdivided in its edge phase.
                    // The inter-edge phase will correctly skip it.

                    // Add endpoint vertex
                    if (isParallelX || (bY >= cellRowYTop && bY <= cellRowYBottom)) {
                        if (bX < leftmostX) {
                            leftmostX = bX;
                            leftmostIndex = ring.length;
                        }
                        ring.push(triangleIndices[(edgeIndex + 1) % 3]);
                    }
                    // Any edge that has endpoint outside this row or on its boundary gets
                    // inter-edge vertices.
                    // No row boundary to split for edges parallel with X
                    if (!isParallelX && (bY <= cellRowYTop || bY >= cellRowYBottom)) {
                        const dir2X = cX - bX;
                        const dir2Y = cY - bY;
                        const t2Top = (cellRowYTop - bY) / dir2Y;
                        const t2Bottom = (cellRowYBottom - bY) / dir2Y;
                        const t2Enter = Math.min(t2Top, t2Bottom);
                        const t2Exit = Math.max(t2Top, t2Bottom);
                        const enter2X = bX + dir2X * t2Enter;
                        let boundarySubdivisionLeftCellX = Math.floor(Math.min(enter2X, exitX) / this._granualityCellSize) + 1;
                        let boundarySubdivisionRightCellX = Math.ceil(Math.max(enter2X, exitX) / this._granualityCellSize) - 1;
                        let isBoundaryLeftToRight = exitX < enter2X;

                        const isParallelX2 = dir2Y === 0;

                        if (isParallelX2 && (cY === cellRowYTop || cY === cellRowYBottom)) {
                            // Special case when edge b->c that lies on the cell boundary.
                            // Do not generate any inter-edge vertices in this case,
                            // this b->c edge gets subdivided when it is itself processed.
                            continue;
                        }

                        if (isParallelX2 || t2Enter >= 1 || t2Exit <= 0) {
                            // The next edge (b->c) lies entirely outside this cell row
                            // Find entry point for the edge after that instead (c->a)

                            // There may be at most 1 edge that is parallel to X in a triangle.
                            // The main "a->b" edge must not be parallel at this point in the code.
                            // We know that "a->b" crosses the current cell row boundary, such that point "b" is beyond the boundary.
                            // If "b->c" is parallel to X, then "c->a" must not be parallel and must cross the cell row boundary back:
                            //      a
                            //      |\
                            // -----|-\--cell row boundary----
                            //      |  \
                            //      c---b
                            // If "b->c" is not parallel to X and doesn't cross the cell row boundary,
                            // then c->a must also not be parallel to X and must cross the cell boundary back,
                            // since points "a" and "c" lie on different sides of the boundary and on different Y coordinates.
                            //
                            // Thus there is no need for "parallel with X" checks inside this condition branch.

                            const dir3X = aX - cX;
                            const dir3Y = aY - cY;
                            const t3Top = (cellRowYTop - cY) / dir3Y;
                            const t3Bottom = (cellRowYBottom - cY) / dir3Y;
                            const t3Enter = Math.min(t3Top, t3Bottom);
                            const enter3X = cX + dir3X * t3Enter;
                            boundarySubdivisionLeftCellX = Math.floor(Math.min(enter3X, exitX) / this._granualityCellSize) + 1;
                            boundarySubdivisionRightCellX = Math.ceil(Math.max(enter3X, exitX) / this._granualityCellSize) - 1;
                            isBoundaryLeftToRight = exitX < enter3X;
                        }

                        const boundaryY = dirY > 0 ? cellRowYBottom : cellRowYTop;
                        if (isBoundaryLeftToRight) {
                            // Left to right
                            for (let cellX = boundarySubdivisionLeftCellX; cellX <= boundarySubdivisionRightCellX; cellX++) {
                                const x = cellX * this._granualityCellSize;
                                ring.push(this.getVertexIndex(x, boundaryY));
                            }
                        } else {
                            // Right to left
                            for (let cellX = boundarySubdivisionRightCellX; cellX >= boundarySubdivisionLeftCellX; cellX--) {
                                const x = cellX * this._granualityCellSize;
                                ring.push(this.getVertexIndex(x, boundaryY));
                            }
                        }
                    }
                }

                // Triangulate the ring
                // It is guaranteed to be convex and ordered
                if (ring.length === 0) {
                    console.error('Subdivision vertex ring length 0, smells like a bug!');
                    continue;
                }

                // Traverse the ring in both directions from the leftmost vertex
                // Assume ring is in CCW order (to produce CCW triangles)
                const ringVertexLength = ring.length;
                let lastEdgeA = leftmostIndex;
                let lastEdgeB = (lastEdgeA + 1) % ringVertexLength;

                while (true) {
                    const candidateIndexA = (lastEdgeA - 1) >= 0 ? (lastEdgeA - 1) : (ringVertexLength - 1);
                    const candidateIndexB = (lastEdgeB + 1) % ringVertexLength;

                    // Pick candidate, move edge
                    const candidateXA = this._finalVertices[ring[candidateIndexA] * 2];
                    const candidateXB = this._finalVertices[ring[candidateIndexB] * 2];

                    if (candidateXA < candidateXB) {
                        // Pick candidate A
                        const c = ring[candidateIndexA];
                        const a = ring[lastEdgeA];
                        const b = ring[lastEdgeB];
                        if (c !== a && c !== b && a !== b) {
                            finalIndices.push(b, a, c);
                        }
                        lastEdgeA--;
                        if (lastEdgeA < 0) {
                            lastEdgeA = ringVertexLength - 1;
                        }
                    } else {
                        // Pick candidate B
                        const c = ring[candidateIndexB];
                        const a = ring[lastEdgeA];
                        const b = ring[lastEdgeB];
                        if (c !== a && c !== b && a !== b) {
                            finalIndices.push(b, a, c);
                        }
                        lastEdgeB++;
                        if (lastEdgeB >= ringVertexLength) {
                            lastEdgeB = 0;
                        }
                    }

                    if (candidateIndexA === candidateIndexB) {
                        break; // We ran out of ring vertices
                    }
                }
            }
        }

        return finalIndices;
    }

    private subdivideLine(lineIndices: Array<number>): Array<number> {
        if (!lineIndices) {
            return [];
        }

        if (this._granuality < 2) {
            return lineIndices;
        }

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

            const cellRangeXmin = Math.floor(minX / this._granualityCellSize + 1);
            const cellRangeYmin = Math.floor(minY / this._granualityCellSize + 1);
            const cellRangeXmax = Math.floor((maxX - 1) / this._granualityCellSize);
            const cellRangeYmax = Math.floor((maxY - 1) / this._granualityCellSize);

            const subdividedLineIndices = [];

            // Add original line vertices
            subdividedLineIndices.push(lineIndex0);
            subdividedLineIndices.push(lineIndex1);

            for (let cellX = cellRangeXmin; cellX <= cellRangeXmax; cellX += 1) {
                const cellEdgeX = cellX * this._granualityCellSize;
                this.checkEdgeSubdivisionX(subdividedLineIndices, lineVertex0x, lineVertex0y, lineVertex1x, lineVertex1y, cellEdgeX, minY, maxY);
            }

            for (let cellY = cellRangeYmin; cellY <= cellRangeYmax; cellY += 1) {
                const cellEdgeY = cellY * this._granualityCellSize;
                this.checkEdgeSubdivisionY(subdividedLineIndices, lineVertex0x, lineVertex0y, lineVertex1x, lineVertex1y, cellEdgeY, minX, maxX);
            }

            const edgeX = lineVertex1x - lineVertex0x;
            const edgeY = lineVertex1y - lineVertex0y;

            if (subdividedLineIndices.length < 2) {
                continue;
            }

            // JP: TODO: this could be done without sorting

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

        // Special pole vertices have Y coordinate -32768 for the north pole and 32767 for the south pole.
        // First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
        const northY = -32768;
        const southY = 32767;

        for (let i = 0; i < flattened.length; i += 2) {
            const vy = flattened[i + 1];
            if (vy === northY) {
                // Move slightly down
                flattened[i + 1] = northY + 1;
            }
            if (vy === southY) {
                // Move slightly down
                flattened[i + 1] = southY - 1;
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
            const v0x = flattened[i0 * 2];
            const v0y = flattened[i0 * 2 + 1];
            const v1x = flattened[i1 * 2];
            const v1y = flattened[i1 * 2 + 1];
            const v2x = flattened[i2 * 2];
            const v2y = flattened[i2 * 2 + 1];

            if (north) {
                if (v0y === northEdge && v1y === northEdge) {
                    indices.push(i0);
                    indices.push(i1);
                    indices.push(this.getVertexIndex(v0x, NORTH_POLE_Y));

                    indices.push(i1);
                    indices.push(this.getVertexIndex(v1x, NORTH_POLE_Y));
                    indices.push(this.getVertexIndex(v0x, NORTH_POLE_Y));
                }
                if (v1y === northEdge && v2y === northEdge) {
                    indices.push(i1);
                    indices.push(i2);
                    indices.push(this.getVertexIndex(v1x, NORTH_POLE_Y));

                    indices.push(i2);
                    indices.push(this.getVertexIndex(v2x, NORTH_POLE_Y));
                    indices.push(this.getVertexIndex(v1x, NORTH_POLE_Y));
                }
                if (v2y === northEdge && v0y === northEdge) {
                    indices.push(i2);
                    indices.push(i0);
                    indices.push(this.getVertexIndex(v2x, NORTH_POLE_Y));

                    indices.push(i0);
                    indices.push(this.getVertexIndex(v0x, NORTH_POLE_Y));
                    indices.push(this.getVertexIndex(v2x, NORTH_POLE_Y));
                }
            }
            if (south) {
                if (v0y === southEdge && v1y === southEdge) {
                    indices.push(i0);
                    indices.push(i1);
                    indices.push(this.getVertexIndex(v0x, SOUTH_POLE_Y));

                    indices.push(i1);
                    indices.push(this.getVertexIndex(v1x, SOUTH_POLE_Y));
                    indices.push(this.getVertexIndex(v0x, SOUTH_POLE_Y));
                }
                if (v1y === southEdge && v2y === southEdge) {
                    indices.push(i1);
                    indices.push(i2);
                    indices.push(this.getVertexIndex(v1x, SOUTH_POLE_Y));

                    indices.push(i2);
                    indices.push(this.getVertexIndex(v2x, SOUTH_POLE_Y));
                    indices.push(this.getVertexIndex(v1x, SOUTH_POLE_Y));
                }
                if (v2y === southEdge && v0y === southEdge) {
                    indices.push(i2);
                    indices.push(i0);
                    indices.push(this.getVertexIndex(v2x, SOUTH_POLE_Y));

                    indices.push(i0);
                    indices.push(this.getVertexIndex(v0x, SOUTH_POLE_Y));
                    indices.push(this.getVertexIndex(v2x, SOUTH_POLE_Y));
                }
            }
        }
    }

    private initializeVertices(vertices: Array<number>) {
        this._finalVertices = [];
        this._vertexDictionary = new Map<number, number>();
        for (let i = 0; i < vertices.length; i += 2) {
            this.getVertexIndex(vertices[i], vertices[i + 1]);
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
    public subdivideFillInternal(vertices: Array<number>, holeIndices: Array<number>, lineIndices: Array<Array<number>>): SubdivisionResult {
        if (this._vertexDictionary) {
            console.error('Subdivider: multiple use not allowed.');
            return undefined;
        }

        // Initialize the vertex dictionary with input vertices since we will use all of them anyway
        this.initializeVertices(vertices);

        // Subdivide lines
        const subdividedLines = [];
        for (const line of lineIndices) {
            subdividedLines.push(this.subdivideLine(this.convertIndices(vertices, line)));
        }

        // Subdivide triangles
        let subdividedTriangles;
        try {
            const cut = this.convertIndices(vertices, earcut(vertices, holeIndices));
            subdividedTriangles = this.subdivideTrianglesScanline(cut);
        } catch (e) {
            console.error(e);
        }

        // Ensure no vertex has the special value used for pole vertices
        this.ensureNoPoleVertices();

        // Add pole vertices if the tile is at north/south mercator edge
        let north = false;
        let south = false;
        if (this._canonical) {
            if (this._canonical.y === 0) {
                north = true;
            }
            if (this._canonical.y === (1 << this._canonical.z) - 1) {
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

    /**
     * Sometimes the supplies vertex and index array has duplicate vertices - same coordinates that are referenced by multiple different indices.
     * That is not allowed for purposes of subdivision, duplicates are removed in `this.initializeVertices`.
     * This function checks all indices, and replaces any index that references a duplicate vertex with the an index that vertex that is actually valid in `this._finalVertices`.
     * @param vertices - Flattened vertex array used by the indices. This may contain duplicate vertices.
     * @param oldIndices - Indices into the supplied vertex array.
     * @returns Indices transformed so that they are valid indices into `this._finalVertices` (with duplicates removed).
     */
    private convertIndices(vertices: Array<number>, oldIndices: Array<number>): Array<number> {
        const newIndices = [];
        for (let i = 0; i < oldIndices.length; i++) {
            const x = vertices[oldIndices[i] * 2];
            const y = vertices[oldIndices[i] * 2 + 1];
            newIndices.push(this.getVertexIndex(x, y));
        }
        return newIndices;
    }

    /**
     * Returns a SVG image (as string) that displays the supplied triangles and lines. Only vertices used by the triangles are included in the svg.
     * @param triangles - Array of triangle indices.
     * @param edges - List of arrays of edge indices. Every pair of indices forms a line. A triangle would look like `[0 1 1 2 2 0]`.
     * @returns SVG image as string.
     */
    public getDebugSvg(triangles?: Array<number>, edges?: Array<Array<number>>): string {
        const svg = [];

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < triangles.length; i++) {
            const x = this._finalVertices[triangles[i] * 2];
            const y = this._finalVertices[triangles[i] * 2 + 1];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - 10} ${minY - 10} ${maxX - minX + 20} ${maxY - minY + 20}">`);

        if (triangles) {
            for (let i = 0; i < triangles.length; i += 3) {
                const i0 = triangles[i];
                const i1 = triangles[i + 1];
                const i2 = triangles[i + 2];

                for (const index of [i0, i1, i2]) {
                    const x = this._finalVertices[index * 2];
                    const y = this._finalVertices[index * 2 + 1];
                    const isOnCellEdge = (x % this._granualityCellSize === 0) || (y % this._granualityCellSize === 0);
                    svg.push(`<circle cx="${x}" cy="${y}" r="1.0" fill="${isOnCellEdge ? 'red' : 'black'}" stroke="none"/>`);
                    svg.push(`<text x="${x + 2}" y="${y - 2}" style="font: 2px sans-serif;">${(index).toString()}</text>`);
                }

                for (const edge of [[i0, i1], [i1, i2], [i2, i0]]) {
                    svg.push(`<line x1="${this._finalVertices[edge[0] * 2]}" y1="${this._finalVertices[edge[0] * 2 + 1]}" x2="${this._finalVertices[edge[1] * 2]}" y2="${this._finalVertices[edge[1] * 2 + 1]}" stroke="black" stroke-width="0.5"/>`);
                }
            }
        }

        if (edges) {
            for (const edgeList of edges) {
                for (let i = 0; i < edgeList.length; i += 2) {
                    svg.push(`<circle cx="${this._finalVertices[edgeList[i] * 2]}" cy="${this._finalVertices[edgeList[i] * 2 + 1]}" r="0.5" fill="green" stroke="none"/>`);
                    svg.push(`<circle cx="${this._finalVertices[edgeList[i + 1] * 2]}" cy="${this._finalVertices[edgeList[i + 1] * 2 + 1]}" r="0.5" fill="green" stroke="none"/>`);
                    svg.push(`<line x1="${this._finalVertices[edgeList[i] * 2]}" y1="${this._finalVertices[edgeList[i] * 2 + 1]}" x2="${this._finalVertices[edgeList[i + 1] * 2]}" y2="${this._finalVertices[edgeList[i + 1] * 2 + 1]}" stroke="green" stroke-width="0.25"/>`);
                }
            }
        }

        svg.push('</svg>');

        return svg.join('');
    }
}

export function subdivideFill(vertices: Array<number>, holeIndices: Array<number>, lineList: Array<Array<number>>, canonical: CanonicalTileID, granuality: number): SubdivisionResult {
    const subdivider = new Subdivider(granuality, canonical);
    return subdivider.subdivideFillInternal(vertices, holeIndices, lineList);
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

/**
 * Subdivides a line represented by an array of points.
 * Assumes a line segment between each two consecutive points in the array.
 * Does not assume a line segment from last point to first point.
 * Eg. an array of 4 points describes exactly 3 line segments.
 */
export function subdivideVertexLine(linePoints: Array<Point>, granuality: number): Array<Point> {
    if (!linePoints) {
        return [];
    }

    if (linePoints.length < 2) {
        return [linePoints[0]];
    }

    if (granuality < 2) {
        return linePoints;
    }

    const granualityStep = Math.floor(EXTENT / granuality);
    const finalLineVertices: Array<Point> = [];

    // Add first line vertex
    finalLineVertices.push(linePoints[0]);

    // Iterate over all input lines
    for (let pointIndex = 1; pointIndex < linePoints.length; pointIndex++) {
        const lineVertex0x = linePoints[pointIndex - 1].x;
        const lineVertex0y = linePoints[pointIndex - 1].y;
        const lineVertex1x = linePoints[pointIndex].x;
        const lineVertex1y = linePoints[pointIndex].y;

        // Get line AABB
        const minX = Math.min(lineVertex0x, lineVertex1x);
        const maxX = Math.max(lineVertex0x, lineVertex1x);
        const minY = Math.min(lineVertex0y, lineVertex1y);
        const maxY = Math.max(lineVertex0y, lineVertex1y);

        const subdividedLinePoints = [];

        // The first vertex of this line segment was already added in previous iteration or at the start of this function.
        // Only add the second vertex of this segment.
        subdividedLinePoints.push(linePoints[pointIndex]);

        const cellXstart = Math.floor((minX + granualityStep) / granualityStep);
        const cellXend = Math.floor((maxX - 1) / granualityStep);
        for (let cellX = cellXstart; cellX <= cellXend; cellX += 1) {
            const cellEdgeX = cellX * granualityStep;
            const y = checkEdgeDivide(lineVertex0x, lineVertex0y, lineVertex1x, lineVertex1y, cellEdgeX);
            if (y !== undefined && y >= minY && y <= maxY) {
                let add = true;
                for (const p of subdividedLinePoints) {
                    if (p.x === cellEdgeX && p.y === y) {
                        add = false; // the vertex already exists in this line, do not add it
                        break;
                    }
                }
                if (add) {
                    subdividedLinePoints.push(new Point(cellEdgeX, y));
                }
            }
        }

        const cellYstart = Math.floor((minY + granualityStep) / granualityStep);
        const cellYend = Math.floor((maxY - 1) / granualityStep);
        for (let cellY = cellYstart; cellY <= cellYend; cellY += 1) {
            const cellEdgeY = cellY * granualityStep;
            const x = checkEdgeDivide(lineVertex0y, lineVertex0x, lineVertex1y, lineVertex1x, cellEdgeY);
            if (x !== undefined && x >= minX && x <= maxX) {
                let add = true;
                for (const p of subdividedLinePoints) {
                    if (p.x === x && p.y === cellEdgeY) {
                        add = false;
                        break;
                    }
                }
                if (add) {
                    subdividedLinePoints.push(new Point(x, cellEdgeY));
                }
            }
        }

        const edgeX = lineVertex1x - lineVertex0x;
        const edgeY = lineVertex1y - lineVertex0y;

        subdividedLinePoints.sort((a: Point, b: Point) => {
            const aDist = a.x * edgeX + a.y * edgeY;
            const bDist = b.x * edgeX + b.y * edgeY;
            if (aDist < bDist) {
                return -1;
            }
            if (aDist > bDist) {
                return 1;
            }
            return 0;
        });

        for (let i = 0; i < subdividedLinePoints.length; i++) {
            finalLineVertices.push(subdividedLinePoints[i]);
        }
    }

    return finalLineVertices;
}
