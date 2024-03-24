import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {CanonicalTileID} from '../source/tile_id';
import earcut from 'earcut';

type SubdivisionResult = {
    verticesFlattened: Array<number>;
    indicesTriangles: Array<number>;

    /**
     * An array of arrays of indices of subdivided lines for polygon outlines.
     * Each array of lines corresponds to one ring of the original polygon.
     */
    indicesLineList: Array<Array<number>>;
};

// Special pole vertices have coordinates -32768,-32768 for the north pole and 32767,32767 for the south pole.
// First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
export const NORTH_POLE_Y = -32768;
export const SOUTH_POLE_Y = 32767;

class Subdivider {
    /**
     * Flattened vertex positions (xyxyxy).
     */
    private _vertexBuffer: Array<number> = [];

    /**
     * Map of "vertex x and y coordinate" to "index of such vertex".
     */
    private _vertexDictionary: Map<number, number> = new Map<number, number>();
    private _used: boolean = false;

    private readonly _canonical: CanonicalTileID;

    private readonly _granularity;
    private readonly _granularityCellSize;

    constructor(granularity: number, canonical: CanonicalTileID) {
        this._granularity = granularity;
        this._granularityCellSize = EXTENT / granularity;
        this._canonical = canonical;
    }

    private _getKey(x: number, y: number) {
        // Assumes signed 16 bit positions.
        x = x + 32768;
        y = y + 32768;
        return (x << 16) | (y << 0);
    }

    /**
     * Returns an index into the internal vertex buffer for a vertex at the given coordinates.
     * If the internal vertex buffer contains no such vertex, then it is added.
     */
    private _getVertexIndex(x: number, y: number): number {
        const xInt = Math.round(x) | 0;
        const yInt = Math.round(y) | 0;
        const key = this._getKey(xInt, yInt);
        if (this._vertexDictionary.has(key)) {
            return this._vertexDictionary.get(key);
        }
        const index = this._vertexBuffer.length / 2;
        this._vertexDictionary.set(key, index);
        this._vertexBuffer.push(xInt, yInt);
        return index;
    }

    /**
     * Subdivides a polygon by iterating over rows of granularity subdivision cells and splitting each row along vertical subdivision axes.
     * @param inputIndices - Indices into the internal vertex buffer of the triangulated polygon (after running `earcut`).
     * @returns Indices into the internal vertex buffer for triangles that are a subdivision of the input geometry.
     */
    private _subdivideTrianglesScanline(inputIndices: Array<number>): Array<number> {
        // A granularity cell is the square space between axes that subdivide geometry.
        // For granularity 8, cells would be 1024 by 1024 units.
        // For each triangle, we iterate over all cell rows it intersects, and generate subdivided geometry
        // only within one cell row at a time. This way, we implicitly subdivide along the X-parallel axes (cell row boundaries).
        // For each cell row, we generate an ordered point ring that describes the subdivided geometry inside this row (an intersection of the triangle and a given cell row).
        // Such ordered ring can be trivially triangulated.
        // Each ring may consist of sections of triangle edges that lie inside the cell row, and cell boundaries that lie inside the triangle. Both must be further subdivided along Y-parallel axes.
        // Most complexity of this function comes from generating correct vertex rings, and from placing the vertices into the ring in the correct order.

        if (this._granularity < 2) {
            // The actual subdivision code always produces triangles with the correct winding order.
            // Also apply winding order correction when skipping subdivision altogether to maintain consistency.
            return fixWindingOrder(this._vertexBuffer, inputIndices);
        }

        const finalIndices = [];

        // Iterate over all input triangles
        const numIndices = inputIndices.length;
        for (let primitiveIndex = 0; primitiveIndex < numIndices; primitiveIndex += 3) {
            const triangleIndices: [number, number, number] = [
                inputIndices[primitiveIndex + 0], // v0
                inputIndices[primitiveIndex + 1], // v1
                inputIndices[primitiveIndex + 2], // v2
            ];

            const triangleVertices: [number, number, number, number, number, number] = [
                this._vertexBuffer[inputIndices[primitiveIndex + 0] * 2 + 0], // v0.x
                this._vertexBuffer[inputIndices[primitiveIndex + 0] * 2 + 1], // v0.y
                this._vertexBuffer[inputIndices[primitiveIndex + 1] * 2 + 0], // v1.x
                this._vertexBuffer[inputIndices[primitiveIndex + 1] * 2 + 1], // v1.y
                this._vertexBuffer[inputIndices[primitiveIndex + 2] * 2 + 0], // v2.x
                this._vertexBuffer[inputIndices[primitiveIndex + 2] * 2 + 1], // v2.y
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

            const cellXmin = Math.floor(minX / this._granularityCellSize);
            const cellXmax = Math.ceil(maxX / this._granularityCellSize);
            const cellYmin = Math.floor(minY / this._granularityCellSize);
            const cellYmax = Math.ceil(maxY / this._granularityCellSize);

            // Skip subdividing triangles that do not span multiple cells - just add them "as is".
            if (cellXmin === cellXmax && cellYmin === cellYmax) {
                finalIndices.push(...triangleIndices);
                continue;
            }

            // Iterate over cell rows that intersect this triangle
            for (let cellRow = cellYmin; cellRow < cellYmax; cellRow++) {
                const {ring, leftmostIndex} = this._scanlineGenerateVertexRingForCellRow(cellRow, triangleVertices, triangleIndices);
                scanlineTriangulateVertexRing(this._vertexBuffer, ring, leftmostIndex, finalIndices);
            }
        }

        return finalIndices;
    }

    /**
     * Takes a triangle and a cell row index, returns a subdivided vertex ring of the intersection of the triangle and the cell row.
     * @param cellRow - Index of the cell row. A cell row of index `i` covert range from `i * granularityCellSize` to `(i + 1) * granularityCellSize`.
     * @param triangleVertices - An array of 6 elements, contains flattened positions of the triangle's vertices: `[v0x, v0y, v1x, v1y, v2x, v2y]`.
     * @param triangleIndices - An array of 3 elements, contains the original indices of the triangle's vertices: `[index0, index1, index2]`.
     * @returns The resulting ring of vertex indices and the index (to the returned ring array) of the leftmost vertex in the ring.
     */
    private _scanlineGenerateVertexRingForCellRow(
        cellRow: number,
        triangleVertices: [number, number, number, number, number, number],
        triangleIndices: [number, number, number]
    ) {
        const cellRowYTop = cellRow * this._granularityCellSize;
        const cellRowYBottom = cellRowYTop + this._granularityCellSize;
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
                ring.push(this._getVertexIndex(x, y));
            }

            const enterX = aX + dirX * Math.max(tEnter, 0);
            const exitX = aX + dirX * Math.min(tExit, 1);
            const leftX = isParallelX ? Math.min(aX, bX) : Math.min(enterX, exitX);
            const rightX = isParallelX ? Math.max(aX, bX) : Math.max(enterX, exitX);

            // No need to subdivide (along X) edges that are parallel with Y
            if (!isParallelY) {
                // Generate edge interior vertices
                const edgeSubdivisionLeftCellX = Math.floor(leftX / this._granularityCellSize) + 1;
                const edgeSubdivisionRightCellX = Math.ceil(rightX / this._granularityCellSize) - 1;

                const isEdgeLeftToRight = isParallelX ? (aX < bX) : (enterX < exitX);
                if (isEdgeLeftToRight) {
                    // Left to right
                    for (let cellX = edgeSubdivisionLeftCellX; cellX <= edgeSubdivisionRightCellX; cellX++) {
                        const x = cellX * this._granularityCellSize;
                        const y = aY + dirY * (x - aX) / dirX;
                        ring.push(this._getVertexIndex(x, y));
                    }
                } else {
                    // Right to left
                    for (let cellX = edgeSubdivisionRightCellX; cellX >= edgeSubdivisionLeftCellX; cellX--) {
                        const x = cellX * this._granularityCellSize;
                        const y = aY + dirY * (x - aX) / dirX;
                        ring.push(this._getVertexIndex(x, y));
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
                ring.push(this._getVertexIndex(x, y));
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
                let boundarySubdivisionLeftCellX = Math.floor(Math.min(enter2X, exitX) / this._granularityCellSize) + 1;
                let boundarySubdivisionRightCellX = Math.ceil(Math.max(enter2X, exitX) / this._granularityCellSize) - 1;
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
                    boundarySubdivisionLeftCellX = Math.floor(Math.min(enter3X, exitX) / this._granularityCellSize) + 1;
                    boundarySubdivisionRightCellX = Math.ceil(Math.max(enter3X, exitX) / this._granularityCellSize) - 1;
                    isBoundaryLeftToRight = exitX < enter3X;
                }

                const boundaryY = dirY > 0 ? cellRowYBottom : cellRowYTop;
                if (isBoundaryLeftToRight) {
                    // Left to right
                    for (let cellX = boundarySubdivisionLeftCellX; cellX <= boundarySubdivisionRightCellX; cellX++) {
                        const x = cellX * this._granularityCellSize;
                        ring.push(this._getVertexIndex(x, boundaryY));
                    }
                } else {
                    // Right to left
                    for (let cellX = boundarySubdivisionRightCellX; cellX >= boundarySubdivisionLeftCellX; cellX--) {
                        const x = cellX * this._granularityCellSize;
                        ring.push(this._getVertexIndex(x, boundaryY));
                    }
                }
            }
        }

        return {
            ring,
            leftmostIndex
        };
    }

    /**
     * Checks the internal vertex buffer for all vertices that might lie on the special pole coordinates and shifts them by one unit.
     * Use for removing unintended pole vertices that might have been created during subdivision. After calling this function, actual pole vertices can be safely generated.
     */
    private _ensureNoPoleVertices() {
        const flattened = this._vertexBuffer;

        // Special pole vertices have Y coordinate -32768 for the north pole and 32767 for the south pole.
        // First, find any *non-pole* vertices at those coordinates and move them slightly elsewhere.
        const northY = NORTH_POLE_Y;
        const southY = SOUTH_POLE_Y;

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
    private _fillPoles(indices: Array<number>, north: boolean, south: boolean): void {
        const flattened = this._vertexBuffer;

        const northEdge = 0;
        const southEdge = EXTENT;

        // Generates a quad from an edge to a pole with the correct winding order.
        // i0, i1 - indices of the edge vertices
        // v0x, v1x - X coordinates of the edge vertices
        // poleY - the Y coordinate of the desired pole (NORTH_POLE_Y or SOUTH_POLE_Y)
        const generatePoleQuad = (i0, i1, v0x, v1x, poleY) => {
            const flip = (v0x > v1x) !== (poleY === NORTH_POLE_Y);

            if (flip) {
                indices.push(i0);
                indices.push(i1);
                indices.push(this._getVertexIndex(v0x, poleY));

                indices.push(i1);
                indices.push(this._getVertexIndex(v1x, poleY));
                indices.push(this._getVertexIndex(v0x, poleY));
            } else {
                indices.push(i1);
                indices.push(i0);
                indices.push(this._getVertexIndex(v0x, poleY));

                indices.push(this._getVertexIndex(v1x, poleY));
                indices.push(i1);
                indices.push(this._getVertexIndex(v0x, poleY));
            }
        };

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
                    generatePoleQuad(i0, i1, v0x, v1x, NORTH_POLE_Y);
                }
                if (v1y === northEdge && v2y === northEdge) {
                    generatePoleQuad(i1, i2, v1x, v2x, NORTH_POLE_Y);
                }
                if (v2y === northEdge && v0y === northEdge) {
                    generatePoleQuad(i2, i0, v2x, v0x, NORTH_POLE_Y);
                }
            }
            if (south) {
                if (v0y === southEdge && v1y === southEdge) {
                    generatePoleQuad(i0, i1, v0x, v1x, SOUTH_POLE_Y);
                }
                if (v1y === southEdge && v2y === southEdge) {
                    generatePoleQuad(i1, i2, v1x, v2x, SOUTH_POLE_Y);
                }
                if (v2y === southEdge && v0y === southEdge) {
                    generatePoleQuad(i2, i0, v2x, v0x, SOUTH_POLE_Y);
                }
            }
        }
    }

    /**
     * Adds all vertices in the supplied flattened vertex buffer into the internal vertex buffer.
     */
    private _initializeVertices(flattened: Array<number>) {
        for (let i = 0; i < flattened.length; i += 2) {
            this._getVertexIndex(flattened[i], flattened[i + 1]);
        }
    }

    /**
     * Subdivides an input mesh. Imagine a regular square grid with the target granularity overlaid over the mesh - this is the subdivision's result.
     * Assumes a mesh of tile features - vertex coordinates are integers, visible range where subdivision happens is 0..8192.
     * @param polygon - The input polygon, specified as a list of vertex rings.
     * @param generateOutlineLines - When true, also generates line indices for outline of the supplied polygon.
     * @returns Vertex and index buffers with subdivision applied.
     */
    public subdivideFillInternal(polygon: Array<Array<Point>>, generateOutlineLines: boolean): SubdivisionResult {
        if (this._used) {
            console.error('Subdivider: multiple use not allowed.');
            return undefined;
        }
        this._used = true;

        // Initialize the vertex dictionary with input vertices since we will use all of them anyway
        const {flattened, holeIndices} = flatten(polygon);
        this._initializeVertices(flattened);

        // Subdivide triangles
        let subdividedTriangles;
        try {
            // At this point this._finalVertices is just flattened polygon points
            const earcutResult = earcut(flattened, holeIndices);
            const cut = this._convertIndices(flattened, earcutResult);
            subdividedTriangles = this._subdivideTrianglesScanline(cut);
        } catch (e) {
            console.error(e);
        }

        // Subdivide lines
        const subdividedLines = [];
        if (generateOutlineLines) {
            for (const ring of polygon) {
                const line = subdivideVertexLine(ring, this._granularity, true);
                const pathIndices = this._pointArrayToIndices(line);
                // Points returned by subdivideVertexLine are "path" waypoints,
                // for example with indices 0 1 2 3 0.
                // We need list of individual line segments for rendering,
                // for example 0, 1, 1, 2, 2, 3, 3, 0.
                const lineIndices = [];
                for (let i = 1; i < pathIndices.length; i++) {
                    lineIndices.push(pathIndices[i - 1]);
                    lineIndices.push(pathIndices[i]);
                }
                subdividedLines.push(lineIndices);
            }
        }

        // Ensure no vertex has the special value used for pole vertices
        this._ensureNoPoleVertices();

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
            this._fillPoles(subdividedTriangles, north, south);
        }

        return {
            verticesFlattened: this._vertexBuffer,
            indicesTriangles: subdividedTriangles,
            indicesLineList: subdividedLines,
        };
    }

    /**
     * Sometimes the supplies vertex and index array has duplicate vertices - same coordinates that are referenced by multiple different indices.
     * That is not allowed for purposes of subdivision, duplicates are removed in `this.initializeVertices`.
     * This function checks all indices, and replaces any index that references a duplicate vertex with the an index that vertex that is actually valid in `this._finalVertices`.
     * @param vertices - Flattened vertex array used by the old indices. This may contain duplicate vertices.
     * @param oldIndices - Indices into the supplied vertex array.
     * @returns Indices transformed so that they are valid indices into `this._finalVertices` (with duplicates removed).
     */
    private _convertIndices(vertices: Array<number>, oldIndices: Array<number>): Array<number> {
        const newIndices = [];
        for (let i = 0; i < oldIndices.length; i++) {
            const x = vertices[oldIndices[i] * 2];
            const y = vertices[oldIndices[i] * 2 + 1];
            newIndices.push(this._getVertexIndex(x, y));
        }
        return newIndices;
    }

    /**
     * Converts an array of points into an array of indices into the internal vertex buffer (`_finalVertices`).
     */
    private _pointArrayToIndices(array: Array<Point>): Array<number> {
        const indices = [];
        for (let i = 0; i < array.length; i++) {
            const p = array[i];
            indices.push(this._getVertexIndex(p.x, p.y));
        }
        return indices;
    }
}

/**
 * Subdivides a polygon to a given granularity. Intended for preprocessing geometry for the 'fill' and 'fill-extrusion' layer types.
 * All returned triangles have the counter-clockwise winding order.
 * @param polygon - An array of point rings that specify the polygon. The first ring is the polygon exterior, all subsequent rings form holes inside the first ring.
 * @param canonical - The canonical tile ID of the tile this polygon belongs to. Needed for generating special geometry for tiles that border the poles.
 * @param granularity - The subdivision granularity. If we assume tile EXTENT=8192, then a granularity of 2 will result in geometry being "cut" on each axis
 * divisible by 4096 (including outside the tile range, so -8192, -4096, or 12288...), granularity of 8 on axes divisible by 1024 and so on.
 * Granularity of 1 or lower results in *no* subdivision.
 * @param generateOutlineLines - When true, also generates index arrays for subdivided lines that form the outline of the supplied polygon. True by default.
 * @returns An object that contains the generated vertex array, triangle index array and, if specified, line index arrays.
 */
export function subdivideFill(polygon: Array<Array<Point>>, canonical: CanonicalTileID, granularity: number, generateOutlineLines: boolean = true): SubdivisionResult {
    const subdivider = new Subdivider(granularity, canonical);
    return subdivider.subdivideFillInternal(polygon, generateOutlineLines);
}

/**
 * Returns an array of line indices for rendering a wireframe of the supplied triangle array. Useful for debugging.
 * @param triangleIndices - An index array where each three indices form a triangle.
 * @returns An index array where each pair of indices forms a line segment.
 */
export function generateWireframeFromTriangles(triangleIndices: Array<number>): Array<number> {
    const lineIndices = [];

    const edgeMap = new Map<string, number>();

    const getKey = (i0, i1) => {
        const e0 = Math.min(i0, i1);
        const e1 = Math.max(i0, i1);
        return `${e0}_${e1}`;
    };

    for (let i = 2; i < triangleIndices.length; i += 3) {
        const i0 = triangleIndices[i - 2];
        const i1 = triangleIndices[i - 1];
        const i2 = triangleIndices[i];

        const k0 = getKey(i0, i1);
        const k1 = getKey(i1, i2);
        const k2 = getKey(i2, i0);

        // Make sure an edge shared by multiple triangles is only present once.
        if (!edgeMap.has(k0)) {
            edgeMap.set(k0, 1);
        } else {
            edgeMap.set(k0, edgeMap.get(k0) + 1);
        }
        if (!edgeMap.has(k1)) {
            edgeMap.set(k1, 1);
        } else {
            edgeMap.set(k1, edgeMap.get(k1) + 1);
        }
        if (!edgeMap.has(k2)) {
            edgeMap.set(k2, 1);
        } else {
            edgeMap.set(k2, edgeMap.get(k2) + 1);
        }
    }

    for (const pair of edgeMap) {
        if (pair[1] === 1) {
            const split = pair[0].split('_');
            const i0 = parseInt(split[0]);
            const i1 = parseInt(split[1]);
            lineIndices.push(i0, i1);
        }
    }

    return lineIndices;
}

/**
 * Subdivides a line represented by an array of points. Mainly intended for preprocessing geometry for the 'line' layer type.
 * Assumes a line segment between each two consecutive points in the array.
 * Does not assume a line segment from last point to first point, unless `isRing` is set to `true`.
 * For example, an array of 4 points describes exactly 3 line segments.
 * @param linePoints - An array of points describing the line segments.
 * @param granularity - Subdivision granularity.
 * @param isRing - When true, an additional line segment is assumed to exist between the input array's last and first point.
 * @returns A new array of points of the subdivided line segments. The array may contain some of the original Point objects. If `isRing` is set to `true`, then this also includes the (subdivided) segment from the last point of the input array to the first point.
 *
 * @example
 * ```ts
 * const result = subdivideVertexLine([
 *   new Point(0, 0),
 *   new Point(8, 0),
 *   new Point(0, 8),
 * ], EXTENT / 4, false);
 * // Results in an array of points with these (x, y) coordinates:
 * //   0, 0
 * //   4, 0
 * //   8, 0
 * //   4, 4
 * //   0, 8
 * ```
 *
 * @example
 * ```ts
 * const result = subdivideVertexLine([
 *   new Point(0, 0),
 *   new Point(8, 0),
 *   new Point(0, 8),
 * ], EXTENT / 4, true);
 * // Results in an array of points with these (x, y) coordinates:
 * //   0, 0
 * //   4, 0
 * //   8, 0
 * //   4, 4
 * //   0, 8
 * //   0, 4
 * //   0, 0
 * ```
 */
export function subdivideVertexLine(linePoints: Array<Point>, granularity: number, isRing: boolean = false): Array<Point> {
    if (!linePoints || linePoints.length < 1) {
        return [];
    }

    if (linePoints.length < 2) {
        return [];
    }

    // Generate an extra line segment between the input array's first and last points,
    // but only if isRing=true AND the first and last points actually differ.
    const first = linePoints[0];
    const last = linePoints[linePoints.length - 1];
    const addLastToFirstSegment = isRing && (first.x !== last.x || first.y !== last.y);

    if (granularity < 2) {
        if (addLastToFirstSegment) {
            return [...linePoints, linePoints[0]];
        } else {
            return [...linePoints];
        }
    }

    const cellSize = Math.floor(EXTENT / granularity);
    const finalLineVertices: Array<Point> = [];

    finalLineVertices.push(new Point(linePoints[0].x, linePoints[0].y));

    // Iterate over all input lines
    const totalPoints = linePoints.length;
    const lastIndex = addLastToFirstSegment ? totalPoints : (totalPoints - 1);
    for (let pointIndex = 0; pointIndex < lastIndex; pointIndex++) {
        const linePoint0 = linePoints[pointIndex];
        const linePoint1 = pointIndex < (totalPoints - 1) ? linePoints[pointIndex + 1] : linePoints[0];
        const lineVertex0x = linePoint0.x;
        const lineVertex0y = linePoint0.y;
        const lineVertex1x = linePoint1.x;
        const lineVertex1y = linePoint1.y;

        const dirXnonZero = lineVertex0x !== lineVertex1x;
        const dirYnonZero = lineVertex0y !== lineVertex1y;

        if (!dirXnonZero && !dirYnonZero) {
            continue;
        }

        const dirX = lineVertex1x - lineVertex0x;
        const dirY = lineVertex1y - lineVertex0y;
        const absDirX = Math.abs(dirX);
        const absDirY = Math.abs(dirY);

        let lastPointX = lineVertex0x;
        let lastPointY = lineVertex0y;

        // Walk along the line segment from start to end. In every step,
        // find out the distance from start until the line intersects either the X-parallel or Y-parallel subdivision axis.
        // Pick the closer intersection, add it to the final line points and consider that point the new start of the line.
        // But also make sure the intersection point does not lie beyond the end of the line.
        // If none of the intersection points is closer than line end, add the endpoint to the final line and break the loop.

        while (true) {
            const nextBoundaryX = dirX > 0 ?
                ((Math.floor(lastPointX / cellSize) + 1) * cellSize) :
                ((Math.ceil(lastPointX / cellSize) - 1) * cellSize);
            const nextBoundaryY = dirY > 0 ?
                ((Math.floor(lastPointY / cellSize) + 1) * cellSize) :
                ((Math.ceil(lastPointY / cellSize) - 1) * cellSize);
            const axisDistanceToBoundaryX = Math.abs(lastPointX - nextBoundaryX);
            const axisDistanceToBoundaryY = Math.abs(lastPointY - nextBoundaryY);

            const axisDistanceToEndX = Math.abs(lastPointX - lineVertex1x);
            const axisDistanceToEndY = Math.abs(lastPointY - lineVertex1y);

            const realDistanceToBoundaryX = dirXnonZero ? axisDistanceToBoundaryX / absDirX : Number.POSITIVE_INFINITY;
            const realDistanceToBoundaryY = dirYnonZero ? axisDistanceToBoundaryY / absDirY : Number.POSITIVE_INFINITY;

            if ((axisDistanceToEndX <= axisDistanceToBoundaryX || !dirXnonZero) &&
            (axisDistanceToEndY <= axisDistanceToBoundaryY || !dirYnonZero)) {
                break;
            }

            if ((realDistanceToBoundaryX < realDistanceToBoundaryY && dirXnonZero) || !dirYnonZero) {
                // We hit the X cell boundary first
                // Always consider the X cell hit if Y dir is zero
                lastPointX = nextBoundaryX;
                lastPointY = lastPointY + dirY * realDistanceToBoundaryX;
                const next = new Point(lastPointX, Math.round(lastPointY));

                // Do not add the next vertex if it is equal to the last added vertex
                if (finalLineVertices[finalLineVertices.length - 1].x !== next.x ||
                    finalLineVertices[finalLineVertices.length - 1].y !== next.y) {
                    finalLineVertices.push(next);
                }
            } else {
                lastPointX = lastPointX + dirX * realDistanceToBoundaryY;
                lastPointY = nextBoundaryY;
                const next = new Point(Math.round(lastPointX), lastPointY);

                if (finalLineVertices[finalLineVertices.length - 1].x !== next.x ||
                    finalLineVertices[finalLineVertices.length - 1].y !== next.y) {
                    finalLineVertices.push(next);
                }
            }
        }

        const last = new Point(lineVertex1x, lineVertex1y);
        if (finalLineVertices[finalLineVertices.length - 1].x !== last.x ||
            finalLineVertices[finalLineVertices.length - 1].y !== last.y) {
            finalLineVertices.push(last);
        }
    }

    return finalLineVertices;
}

/**
 * Takes a polygon as an array of point rings, returns a flattened array of the X,Y coordinates of these points.
 * Also creates an array of hole indices. Both returned arrays are required for `earcut`.
 */
function flatten(polygon: Array<Array<Point>>) {
    const holeIndices = [];
    const flattened = [];

    for (const ring of polygon) {
        if (ring.length === 0) {
            continue;
        }

        if (ring !== polygon[0]) {
            holeIndices.push(flattened.length / 2);
        }

        for (let i = 0; i < ring.length; i++) {
            flattened.push(ring[i].x);
            flattened.push(ring[i].y);
        }
    }

    return {
        flattened,
        holeIndices
    };
}

/**
 * Returns a new array of indices where all triangles have the counter-clockwise winding order.
 * @param flattened - Flattened vertex buffer.
 * @param indices - Triangle indices.
 */
export function fixWindingOrder(flattened: Array<number>, indices: Array<number>): Array<number> {
    const corrected = [];

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const v0x = flattened[i0 * 2];
        const v0y = flattened[i0 * 2 + 1];
        const v1x = flattened[i1 * 2];
        const v1y = flattened[i1 * 2 + 1];
        const v2x = flattened[i2 * 2];
        const v2y = flattened[i2 * 2 + 1];

        const e0x = v1x - v0x;
        const e0y = v1y - v0y;
        const e1x = v2x - v0x;
        const e1y = v2y - v0y;

        const crossProduct = e0x * e1y - e0y * e1x;

        if (crossProduct > 0) {
            // Flip
            corrected.push(i0);
            corrected.push(i2);
            corrected.push(i1);
        } else {
            // Don't flip
            corrected.push(i0);
            corrected.push(i1);
            corrected.push(i2);
        }
    }

    return corrected;
}

/**
 * Returns a SVG image (as string) that displays the supplied triangles and lines. Only vertices used by the triangles are included in the svg.
 * @param flattened - Array of flattened vertex coordinates.
 * @param triangles - Array of triangle indices.
 * @param edges - List of arrays of edge indices. Every pair of indices forms a line. A single triangle would look like `[[0 1 1 2 2 0]]`.
 * @returns SVG image as string.
 */
export function getDebugSvg(flattened: Array<number>, triangles?: Array<number>, edges?: Array<Array<number>>, granularity: number = 1): string {
    const svg = [];

    const cellSize = EXTENT / granularity;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < triangles.length; i++) {
        const x = flattened[triangles[i] * 2];
        const y = flattened[triangles[i] * 2 + 1];
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
                const x = flattened[index * 2];
                const y = flattened[index * 2 + 1];
                const isOnCellEdge = (x % cellSize === 0) || (y % cellSize === 0);
                svg.push(`<circle cx="${x}" cy="${y}" r="1.0" fill="${isOnCellEdge ? 'red' : 'black'}" stroke="none"/>`);
                svg.push(`<text x="${x + 2}" y="${y - 2}" style="font: 2px sans-serif;">${(index).toString()}</text>`);
            }

            for (const edge of [[i0, i1], [i1, i2], [i2, i0]]) {
                svg.push(`<line x1="${flattened[edge[0] * 2]}" y1="${flattened[edge[0] * 2 + 1]}" x2="${flattened[edge[1] * 2]}" y2="${flattened[edge[1] * 2 + 1]}" stroke="black" stroke-width="0.5"/>`);
            }
        }
    }

    if (edges) {
        for (const edgeList of edges) {
            for (let i = 0; i < edgeList.length; i += 2) {
                svg.push(`<circle cx="${flattened[edgeList[i] * 2]}" cy="${flattened[edgeList[i] * 2 + 1]}" r="0.5" fill="green" stroke="none"/>`);
                svg.push(`<circle cx="${flattened[edgeList[i + 1] * 2]}" cy="${flattened[edgeList[i + 1] * 2 + 1]}" r="0.5" fill="green" stroke="none"/>`);
                svg.push(`<line x1="${flattened[edgeList[i] * 2]}" y1="${flattened[edgeList[i] * 2 + 1]}" x2="${flattened[edgeList[i + 1] * 2]}" y2="${flattened[edgeList[i + 1] * 2 + 1]}" stroke="green" stroke-width="0.25"/>`);
            }
        }
    }

    svg.push('</svg>');

    return svg.join('');
}

/**
 * Triangulates a ring of vertex indices. Appends to the supplied array of final triangle indices.
 * @param vertexBuffer - Flattened vertex coordinate array.
 * @param ring - Ordered ring of vertex indices to triangulate.
 * @param leftmostIndex - The index of the leftmost vertex in the supplied ring.
 * @param finalIndices - Array of final triangle indices, into where the resulting triangles are appended.
 */
export function scanlineTriangulateVertexRing(vertexBuffer: Array<number>, ring: Array<number>, leftmostIndex: number, finalIndices: Array<number>): void {
    // Triangulate the ring
    // It is guaranteed to be convex and ordered
    if (ring.length === 0) {
        console.error('Subdivision vertex ring length 0, smells like a bug!');
        return;
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
        const candidateAx = vertexBuffer[ring[candidateIndexA] * 2];
        const candidateAy = vertexBuffer[ring[candidateIndexA] * 2 + 1];
        const candidateBx = vertexBuffer[ring[candidateIndexB] * 2];
        const candidateBy = vertexBuffer[ring[candidateIndexB] * 2 + 1];
        const lastEdgeAx = vertexBuffer[ring[lastEdgeA] * 2];
        const lastEdgeAy = vertexBuffer[ring[lastEdgeA] * 2 + 1];
        const lastEdgeBx = vertexBuffer[ring[lastEdgeB] * 2];
        const lastEdgeBy = vertexBuffer[ring[lastEdgeB] * 2 + 1];

        let pickA = false;

        if (candidateAx < candidateBx) {
            pickA = true;
        } else if (candidateAx > candidateBx) {
            pickA = false;
        } else {
            // Pick the candidate that is more "right" of the last edge's line
            const ex = lastEdgeBx - lastEdgeAx;
            const ey = lastEdgeBy - lastEdgeAy;
            const nx = ey;
            const ny = -ex;
            const sign = (lastEdgeAy < lastEdgeBy) ? 1 : -1;
            // dot( (candidateA <-- lastEdgeA), normal )
            const aRight = ((candidateAx - lastEdgeAx) * nx + (candidateAy - lastEdgeAy) * ny) * sign;
            // dot( (candidateB <-- lastEdgeA), normal )
            const bRight = ((candidateBx - lastEdgeAx) * nx + (candidateBy - lastEdgeAy) * ny) * sign;
            if (aRight > bRight) {
                pickA = true;
            }
        }

        if (pickA) {
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
