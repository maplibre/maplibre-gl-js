import {EXTENT} from '../../../src/data/extent';
import {clamp} from '../../../src/util/util';

export type SimpleSegment = {
    vertexOffset: number;
    primitiveOffset: number;
    primitiveLength: number;
};

export type SimpleMesh = {
    segmentsTriangles: Array<SimpleSegment>;
    segmentsLines: Array<SimpleSegment>;
    vertices: Array<number>;
    indicesTriangles: Array<number>;
    indicesLines: Array<number>;
};

/**
 * Generates a simple grid mesh that has `size` by `size` quads.
 */
export function getGridMesh(size: number): SimpleMesh {
    const vertices = [];
    const indicesTriangles = [];
    const indicesLines = [];

    const verticesPerAxis = size + 1;

    // Generate vertices
    for (let y = 0; y < verticesPerAxis; y++) {
        for (let x = 0; x < verticesPerAxis; x++) {
            vertices.push(x, y);
        }
    }

    // Generate indices
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i00 = (y * verticesPerAxis) + x;
            const i10 = (y * verticesPerAxis) + (x + 1);
            const i01 = ((y + 1) * verticesPerAxis) + x;
            const i11 = ((y + 1) * verticesPerAxis) + (x + 1);
            indicesTriangles.push(i00, i11, i10);
            indicesTriangles.push(i00, i01, i11);
        }
    }

    // Generate lines

    // Top
    for (let i = 0; i < size; i++) {
        indicesLines.push(
            i,
            i +  1
        );
    }
    // Bottom
    for (let i = 0; i < size; i++) {
        indicesLines.push(
            verticesPerAxis * size + i,
            verticesPerAxis * size + i + 1
        );
    }
    // Left
    for (let i = 0; i < size; i++) {
        indicesLines.push(
            i * verticesPerAxis,
            (i + 1) * verticesPerAxis
        );
    }
    // Right
    for (let i = 0; i < size; i++) {
        indicesLines.push(
            i * verticesPerAxis + size,
            (i + 1) * verticesPerAxis + size
        );
    }

    return {
        segmentsTriangles: [{
            primitiveLength: indicesTriangles.length / 3,
            primitiveOffset: 0,
            vertexOffset: 0,
        }],
        segmentsLines: [{
            primitiveLength: indicesLines.length / 2,
            primitiveOffset: 0,
            vertexOffset: 0,
        }],
        vertices,
        indicesTriangles,
        indicesLines
    };
}

// https://stackoverflow.com/a/47593316
// https://gist.github.com/tommyettinger/46a874533244883189143505d203312c?permalink_comment_id=4365431#gistcomment-4365431
function splitmix32(a) {
    return function() {
        a |= 0;
        a = a + 0x9e3779b9 | 0;
        let t = a ^ a >>> 16;
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15;
        t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    };
}

/**
 * Generates a mesh with the vertices of a grid, but random triangles and lines.
 */
export function getGridMeshRandom(size: number, triangleCount: number, lineCount: number): SimpleMesh {
    const vertices = [];
    const indicesTriangles = [];
    const indicesLines = [];

    const verticesPerAxis = size + 1;

    // Generate vertices
    for (let y = 0; y < verticesPerAxis; y++) {
        for (let x = 0; x < verticesPerAxis; x++) {
            vertices.push(x, y);
        }
    }

    const vertexCount = vertices.length / 2;
    const random = splitmix32(0x0badf00d);

    for (let i = 0; i < triangleCount; i++) {
        const i0 = clamp(Math.floor(random() * vertexCount), 0, vertexCount);
        let i1 = clamp(Math.floor(random() * vertexCount), 0, vertexCount);
        let i2 = clamp(Math.floor(random() * vertexCount), 0, vertexCount);
        while (i1 === i0) {
            i1 = (i1 + 1) % vertexCount;
        }
        while (i2 === i0 || i2 === i1) {
            i2 = (i2 + 1) % vertexCount;
        }
        indicesTriangles.push(i0, i1, i2);
    }

    for (let i = 0; i < lineCount; i++) {
        const i0 = clamp(Math.floor(random() * vertexCount), 0, vertexCount);
        let i1 = clamp(Math.floor(random() * vertexCount), 0, vertexCount);
        while (i1 === i0) {
            i1 = (i1 + 1) % vertexCount;
        }
        indicesLines.push(i0, i1);
    }

    return {
        segmentsTriangles: [{
            primitiveLength: indicesTriangles.length / 3,
            primitiveOffset: 0,
            vertexOffset: 0,
        }],
        segmentsLines: [{
            primitiveLength: indicesLines.length / 2,
            primitiveOffset: 0,
            vertexOffset: 0,
        }],
        vertices,
        indicesTriangles,
        indicesLines
    };
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
