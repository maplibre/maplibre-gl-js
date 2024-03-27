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
}

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
            vertices.push(x);
            vertices.push(y);
        }
    }

    // Generate indices
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i00 = (y * verticesPerAxis) + x;
            const i10 = (y * verticesPerAxis) + (x + 1);
            const i01 = ((y + 1) * verticesPerAxis) + x;
            const i11 = ((y + 1) * verticesPerAxis) + (x + 1);
            indicesTriangles.push(i00);
            indicesTriangles.push(i11);
            indicesTriangles.push(i10);
            indicesTriangles.push(i00);
            indicesTriangles.push(i01);
            indicesTriangles.push(i11);
        }
    }

    // Generate lines

    // Top
    for (let i = 0; i < size; i++) {
        indicesLines.push(i);
        indicesLines.push(i + 1);
    }
    // Bottom
    for (let i = 0; i < size; i++) {
        indicesLines.push(verticesPerAxis * size + i);
        indicesLines.push(verticesPerAxis * size + i + 1);
    }
    // Left
    for (let i = 0; i < size; i++) {
        indicesLines.push(i * verticesPerAxis);
        indicesLines.push((i + 1) * verticesPerAxis);
    }
    // Right
    for (let i = 0; i < size; i++) {
        indicesLines.push(i * verticesPerAxis + size);
        indicesLines.push((i + 1) * verticesPerAxis + size);
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
            vertices.push(x);
            vertices.push(y);
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
