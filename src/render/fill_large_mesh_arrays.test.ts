import {LineIndexArray, TriangleIndexArray} from '../data/array_types.g';
import {SegmentVector} from '../data/segment';
import {StructArray} from '../util/struct_array';
import {clamp} from '../util/util';
import {fillLargeMeshArrays} from './fill_large_mesh_arrays';
import {VirtualIndexBufferLines, VirtualIndexBufferTriangles, VirtualVertexBuffer} from '../../test/unit/lib/virtual_gl_buffers';

describe('fillArrays', () => {
    test('Tiny mesh is unchanged.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const mesh = getGridMesh(1);
        const split = splitMesh(mesh);
        expect(split.segmentsTriangles).toHaveLength(1);
        testMeshesEqual(mesh, split);
    });

    test('Small mesh is unchanged.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const mesh = getGridMesh(2);
        const split = splitMesh(mesh);
        expect(split.segmentsTriangles).toHaveLength(1);
        testMeshesEqual(mesh, split);
    });

    test('Large mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const mesh = getGridMesh(4);
        const split = splitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });

    test('Very large mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 1024;
        const mesh = getGridMesh(64);
        const split = splitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });

    test('Very large random mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 1024;
        const mesh = getGridMeshRandom(64, 8192, 1024);
        const split = splitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });
});

type SimpleSegment = {
    vertexOffset: number;
    primitiveOffset: number;
    primitiveLength: number;
};

type SimpleMesh = {
    segmentsTriangles: Array<SimpleSegment>;
    segmentsLines: Array<SimpleSegment>;
    vertices: Array<number>;
    indicesTriangles: Array<number>;
    indicesLines: Array<number>;
}

function splitMesh(mesh: SimpleMesh): SimpleMesh {
    const segmentsTriangles = new SegmentVector();
    const segmentsLines = new SegmentVector();

    const virtualVertices = new VirtualVertexBuffer();
    const virtualIndicesTriangles = new VirtualIndexBufferTriangles();
    const virtualIndicesLines = new VirtualIndexBufferLines();

    fillLargeMeshArrays(
        segmentsTriangles,
        segmentsLines,
        virtualVertices as any as StructArray,
        virtualIndicesTriangles as any as TriangleIndexArray,
        virtualIndicesLines as any as LineIndexArray,
        mesh.vertices,
        mesh.indicesTriangles,
        [mesh.indicesLines],
        (x, y) => {
            virtualVertices.emplaceBack(x, y);
        });

    return {
        segmentsTriangles: segmentsTriangles.segments,
        segmentsLines: segmentsLines.segments,
        vertices: virtualVertices.data,
        indicesTriangles: virtualIndicesTriangles.data,
        indicesLines: virtualIndicesLines.data
    };
}

function testMeshesEqual(expected: SimpleMesh, actual: SimpleMesh) {
    const stringsExpected = getStrings(expected);
    const stringsActual = getStrings(actual);
    expect(stringsActual.stringsTriangles).toEqual(stringsExpected.stringsTriangles);
    expect(stringsActual.stringsLines).toEqual(stringsExpected.stringsLines);
}

/**
 * Returns a string representation of the geometry of the mesh.
 */
function getStrings(mesh: SimpleMesh) {
    const stringsTriangles = [];
    const stringsLines = [];

    for (const s of mesh.segmentsTriangles) {
        for (let i = 0; i < s.primitiveLength; i++) {
            const i0 = s.vertexOffset + mesh.indicesTriangles[(s.primitiveOffset + i) * 3];
            const i1 = s.vertexOffset + mesh.indicesTriangles[(s.primitiveOffset + i) * 3 + 1];
            const i2 = s.vertexOffset + mesh.indicesTriangles[(s.primitiveOffset + i) * 3 + 2];
            const v0x = mesh.vertices[i0 * 2];
            const v0y = mesh.vertices[i0 * 2 + 1];
            const v1x = mesh.vertices[i1 * 2];
            const v1y = mesh.vertices[i1 * 2 + 1];
            const v2x = mesh.vertices[i2 * 2];
            const v2y = mesh.vertices[i2 * 2 + 1];
            const str = `(${v0x} ${v0y}) (${v1x} ${v1y}) (${v2x} ${v2y})`;
            stringsTriangles.push(str);
        }
    }

    for (const s of mesh.segmentsLines) {
        for (let i = 0; i < s.primitiveLength; i++) {
            const i0 = s.vertexOffset + mesh.indicesLines[(s.primitiveOffset + i) * 2];
            const i1 = s.vertexOffset + mesh.indicesLines[(s.primitiveOffset + i) * 2 + 1];
            const v0x = mesh.vertices[i0 * 2];
            const v0y = mesh.vertices[i0 * 2 + 1];
            const v1x = mesh.vertices[i1 * 2];
            const v1y = mesh.vertices[i1 * 2 + 1];
            const str = `(${v0x} ${v0y}) (${v1x} ${v1y})`;
            stringsLines.push(str);
        }
    }

    return {
        stringsTriangles,
        stringsLines
    };
}

/**
 * Generates a simple grid mesh that has `size` by `size` quads.
 */
function getGridMesh(size: number): SimpleMesh {
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
function getGridMeshRandom(size: number, triangleCount: number, lineCount: number): SimpleMesh {
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
