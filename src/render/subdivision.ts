import {EXTENT} from '../data/extent';

type SubdividedMesh = {
    vertices: Array<number>;
    indices: Array<number>;
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
 * @param e0x Edge vertex 0 x.
 * @param e0y Edge vertex 0 y.
 * @param e1x Edge vertex 1 x.
 * @param e1y Edge vertex 1 y.
 * @param divideX Division line X coordinate.
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

/**
 * Subdivides an input mesh. Imagine a regular square grid with the target granuality overlaid over the mesh - this is the subdivision's result.
 * Assumes a mesh of tile features - vertex coordinates are integers, visible range where subdivision happens is 0..8191.
 * @param vertices Input vertex buffer, flattened - two values per vertex (x, y).
 * @param indices Input index buffer.
 * @param granuality Target granuality. If less or equal to 1, the input buffers are returned without modification.
 * @returns Vertex and index buffers with subdivision applied.
 */
export function subdivideTriangles(vertices: Array<number>, indices: Array<number>, granuality: number): SubdividedMesh {
    if (granuality <= 1) {
        return {
            vertices: [...vertices],
            indices: [...indices]
        };
    }

    function getKey(x: number, y: number) {
        return Math.floor(x).toString(36) + Math.floor(y).toString(36);
    }

    const finalVertices = [...vertices]; // initialize with input vertices since we will use all of them anyway
    const vertexDictionary = {};

    // Fill in indices for all starting vertices
    for (let i = 0; i < vertices.length; i += 2) {
        const index = i / 2;
        const key = getKey(vertices[i], vertices[i + 1]);
        vertexDictionary[key] = index;
    }

    // Returns the index of an arbitrary vertex - if it does not exist yet, creates it first.
    function getVertexIndex(x: number, y: number): number {
        const key = getKey(x, y);
        if (key in vertexDictionary) {
            return vertexDictionary[key];
        }
        const index = finalVertices.length / 2;
        vertexDictionary[key] = index;
        finalVertices.push(x);
        finalVertices.push(y);
        return index;
    }

    const finalIndices = [];

    const granualityStep = EXTENT / granuality;

    function checkEdgeSubdivisionX(indicesInsideCell: Array<number>, e0x: number, e0y: number, e1x: number, e1y: number, divideX: number, boundMin: number, boundMax: number): void {
        const y = checkEdgeDivide(e0x, e0y, e1x, e1y, divideX);
        if (y !== undefined && y >= boundMin && y <= boundMax) {
            addUnique(indicesInsideCell, getVertexIndex(divideX, y));
        }
    }
    function checkEdgeSubdivisionY(indicesInsideCell: Array<number>, e0x: number, e0y: number, e1x: number, e1y: number, divideY: number, boundMin: number, boundMax: number): void {
        const x = checkEdgeDivide(e0y, e0x, e1y, e1x, divideY); // reuse checkEdgeDivide that only checks division line parallel to Y by swaping x and y in edge coordinates
        if (x !== undefined && x >= boundMin && x <= boundMax) {
            addUnique(indicesInsideCell, getVertexIndex(x, divideY));
        }
    }

    // Iterate over all input triangles
    for (let primitiveIndex = 0; primitiveIndex < indices.length; primitiveIndex += 3) {
        const triangleIndices = [
            indices[primitiveIndex + 0], // v0
            indices[primitiveIndex + 1], // v1
            indices[primitiveIndex + 2], // v2
        ];

        const triangleVertices = [
            vertices[indices[primitiveIndex + 0] * 2 + 0], // v0.x
            vertices[indices[primitiveIndex + 0] * 2 + 1], // v0.y
            vertices[indices[primitiveIndex + 1] * 2 + 0], // v1.x
            vertices[indices[primitiveIndex + 1] * 2 + 1], // v1.y
            vertices[indices[primitiveIndex + 2] * 2 + 0], // v2.x
            vertices[indices[primitiveIndex + 2] * 2 + 1], // v2.y
        ];

        // Get triangle AABB
        const minX = Math.min(triangleVertices[0], triangleVertices[2], triangleVertices[4]);
        const maxX = Math.max(triangleVertices[0], triangleVertices[2], triangleVertices[4]);
        const minY = Math.min(triangleVertices[1], triangleVertices[3], triangleVertices[5]);
        const maxY = Math.max(triangleVertices[1], triangleVertices[3], triangleVertices[5]);

        // Iterate over all the "granuality grid" cells that might intersect this triangle
        for (let cellX = Math.floor(Math.max(minX, 0) / granualityStep); cellX <= Math.floor((Math.min(maxX, EXTENT - 1) + granualityStep - 1) / granualityStep); cellX += 1) {
            for (let cellY = Math.floor(Math.max(minY, 0) / granualityStep); cellY <= Math.floor((Math.min(maxY, EXTENT - 1) + granualityStep - 1) / granualityStep); cellY += 1) {
                // Cell AABB
                const cellMinX = cellX * granualityStep;
                const cellMinY = cellY * granualityStep;
                const cellMaxX = (cellX + 1) * granualityStep;
                const cellMaxY = (cellY + 1) * granualityStep;

                // Find all vertices (and their indices) that are inside this cell.
                const indicesInsideCell = [];

                // Check all original triangle vertices
                if (triangleVertices[0] >= cellMinX && triangleVertices[0] <= cellMaxX &&
                    triangleVertices[1] >= cellMinY && triangleVertices[1] <= cellMaxY) {
                    addUnique(indicesInsideCell, triangleIndices[0]);
                }
                if (triangleVertices[2] >= cellMinX && triangleVertices[2] <= cellMaxX &&
                    triangleVertices[3] >= cellMinY && triangleVertices[3] <= cellMaxY) {
                    addUnique(indicesInsideCell, triangleIndices[1]);
                }
                if (triangleVertices[4] >= cellMinX && triangleVertices[4] <= cellMaxX &&
                    triangleVertices[5] >= cellMinY && triangleVertices[5] <= cellMaxY) {
                    addUnique(indicesInsideCell, triangleIndices[2]);
                }

                // Check all cell edge vertices
                if (pointInTriangle(cellMinX, cellMinY, triangleVertices)) {
                    addUnique(indicesInsideCell, getVertexIndex(cellMinX, cellMinY));
                }
                if (pointInTriangle(cellMaxX, cellMinY, triangleVertices)) {
                    addUnique(indicesInsideCell, getVertexIndex(cellMaxX, cellMinY));
                }
                if (pointInTriangle(cellMinX, cellMaxY, triangleVertices)) {
                    addUnique(indicesInsideCell, getVertexIndex(cellMinX, cellMaxY));
                }
                if (pointInTriangle(cellMaxX, cellMaxY, triangleVertices)) {
                    addUnique(indicesInsideCell, getVertexIndex(cellMaxX, cellMaxY));
                }

                // Check all intersections between triangle edges and cell edges
                for (let edge = 0; edge < 3; edge++) {
                    const e0x = triangleVertices[(edge % 3) * 2 + 0];
                    const e0y = triangleVertices[(edge % 3) * 2 + 1];
                    const e1x = triangleVertices[((edge + 1) % 3) * 2 + 0];
                    const e1y = triangleVertices[((edge + 1) % 3) * 2 + 1];
                    checkEdgeSubdivisionX(indicesInsideCell, e0x, e0y, e1x, e1y, cellMinX, cellMinY, cellMaxY);
                    checkEdgeSubdivisionX(indicesInsideCell, e0x, e0y, e1x, e1y, cellMaxX, cellMinY, cellMaxY);
                    checkEdgeSubdivisionY(indicesInsideCell, e0x, e0y, e1x, e1y, cellMinY, cellMinX, cellMaxX);
                    checkEdgeSubdivisionY(indicesInsideCell, e0x, e0y, e1x, e1y, cellMaxY, cellMinX, cellMaxX);
                }

                // Now, indicesInsideCell contains all the vertices this subdivided cell contains - but in arbitrary order!
                // We will now order them clockwise, from there generating the triangles is simple.
                // We take advantage of the fact that the shape we want to triangulate is convex, and thus the average of all its vertices is guaranteed to lie inside the shape.
                // Thus we will simply order the vertices by their azimuth angle from the average point.

                let avgX = 0;
                let avgY = 0;

                for (let i = 0; i < indicesInsideCell.length; i++) {
                    avgX += finalVertices[indicesInsideCell[i] * 2 + 0];
                    avgY += finalVertices[indicesInsideCell[i] * 2 + 1];
                }

                avgX /= indicesInsideCell.length;
                avgY /= indicesInsideCell.length;

                indicesInsideCell.sort((a: number, b: number) => {
                    const ax = finalVertices[a * 2 + 0] - avgX;
                    const ay = finalVertices[a * 2 + 1] - avgY;
                    const bx = finalVertices[b * 2 + 0] - avgX;
                    const by = finalVertices[b * 2 + 1] - avgY;
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
                    const ax = finalVertices[indicesInsideCell[i - 1] * 2 + 0] - finalVertices[indicesInsideCell[0] * 2 + 0];
                    const ay = finalVertices[indicesInsideCell[i - 1] * 2 + 1] - finalVertices[indicesInsideCell[0] * 2 + 1];
                    const bx = finalVertices[indicesInsideCell[i] * 2 + 0] - finalVertices[indicesInsideCell[0] * 2 + 0];
                    const by = finalVertices[indicesInsideCell[i] * 2 + 1] - finalVertices[indicesInsideCell[0] * 2 + 1];

                    const c = cross(ax, ay, bx, by);

                    // Skip degenerate (linear) triangles
                    if (c === 0 ||
                        (finalVertices[indicesInsideCell[0] * 2 + 0] === finalVertices[indicesInsideCell[i] * 2 + 0] && finalVertices[indicesInsideCell[0] * 2 + 0] === finalVertices[indicesInsideCell[i - 1] * 2 + 0]) ||
                        (finalVertices[indicesInsideCell[0] * 2 + 1] === finalVertices[indicesInsideCell[i] * 2 + 1] && finalVertices[indicesInsideCell[0] * 2 + 1] === finalVertices[indicesInsideCell[i - 1] * 2 + 1])) {
                        continue;
                    }

                    finalIndices.push(indicesInsideCell[0]);
                    finalIndices.push(indicesInsideCell[i - 1]);
                    finalIndices.push(indicesInsideCell[i]);

                    const triangleVertices2 = [
                        finalVertices[finalIndices[finalIndices.length - 3] * 2 + 0], // v0.x
                        finalVertices[finalIndices[finalIndices.length - 3] * 2 + 1], // v0.y
                        finalVertices[finalIndices[finalIndices.length - 2] * 2 + 0], // v1.x
                        finalVertices[finalIndices[finalIndices.length - 2] * 2 + 1], // v1.y
                        finalVertices[finalIndices[finalIndices.length - 1] * 2 + 0], // v2.x
                        finalVertices[finalIndices[finalIndices.length - 1] * 2 + 1], // v2.y
                    ];
                    //   v1--v2
                    //   |  /
                    //   | /
                    //   v0
                    // a: v0->v1
                    // b: v0->v2
                    if (c <= 0) {
                        let msg = `Panic! a CCW or degenerate triangle!
                        \nBad triangle: ${triangleVertices2.toString()}
                        \nOriginal triangle: ${triangleVertices.toString()}
                        \nCell box: X: ${cellMinX} to ${cellMaxX}; Y: ${cellMinY} to ${cellMaxY}
                        \nAngle a: ${angle(triangleVertices2[0] - avgX, triangleVertices2[1] - avgY) / Math.PI * 180.0}
                        \nAngle b: ${angle(triangleVertices2[2] - avgX, triangleVertices2[3] - avgY) / Math.PI * 180.0}
                        \nAngle c: ${angle(triangleVertices2[4] - avgX, triangleVertices2[5] - avgY) / Math.PI * 180.0}
                        \nCross: ${c}
                        \nAvg: X: ${avgX} Y: ${avgY}
                        \nAll ordered vertices:`;
                        for (let j = 0; j < indicesInsideCell.length; j++) {
                            msg += `\n${finalVertices[indicesInsideCell[j] * 2 + 0]} ${finalVertices[indicesInsideCell[j] * 2 + 1]}`;
                        }
                        msg += '\n---';
                        console.log(msg);

                        // return {
                        //     vertices: [...vertices],
                        //     indices: [...indices]
                        // };
                    }
                }
            }
        }
    }

    // for (let i = 0; i < finalIndices.length; i += 3) {
    //     const triangleVertices = [
    //         finalVertices[finalIndices[i + 0] * 2 + 0], // v0.x
    //         finalVertices[finalIndices[i + 0] * 2 + 1], // v0.y
    //         finalVertices[finalIndices[i + 1] * 2 + 0], // v1.x
    //         finalVertices[finalIndices[i + 1] * 2 + 1], // v1.y
    //         finalVertices[finalIndices[i + 2] * 2 + 0], // v2.x
    //         finalVertices[finalIndices[i + 2] * 2 + 1], // v2.y
    //     ];
    //     //   v1--v2
    //     //   |  /
    //     //   | /
    //     //   v0
    //     // a: v0->v1
    //     // b: v0->v2
    //     const ax = triangleVertices[2] - triangleVertices[0];
    //     const ay = triangleVertices[3] - triangleVertices[1];
    //     const bx = triangleVertices[4] - triangleVertices[0];
    //     const by = triangleVertices[5] - triangleVertices[1];
    //     const c = cross(ax, ay, bx, by);
    //     if (c >= 0) {
    //         console.log('Panic! a CCW or degenerate triangle!');
    //         console.log(triangleVertices);
    //         return {
    //             vertices: [...vertices],
    //             indices: [...indices]
    //         };
    //     }
    // }

    return {
        vertices: finalVertices,
        indices: finalIndices
    };
}
