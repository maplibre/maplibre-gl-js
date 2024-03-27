import {LineIndexArray, TriangleIndexArray} from '../data/array_types.g';
import {SegmentVector} from '../data/segment';
import {StructArray} from '../util/struct_array';
import {fillLargeMeshArrays} from './fill_large_mesh_arrays';
import {VirtualIndexBufferLines, VirtualIndexBufferTriangles, VirtualVertexBuffer} from '../../test/unit/lib/virtual_gl_buffers';
import {SimpleMesh, getGridMesh, getGridMeshRandom} from '../../test/unit/lib/mesh_utils';

describe('fillArrays', () => {
    test('Mesh comparison works', () => {
        const meshA: SimpleMesh = {
            vertices: [
                0, 0, // 0       0 ---- 1
                1, 0, // 1       |      |
                1, 1, // 2       |      |
                0, 1  // 3       3 ---- 2
            ],
            indicesTriangles: [
                0, 3, 1,
                3, 2, 1
            ],
            indicesLines: [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ],
            segmentsTriangles: [
                {
                    vertexOffset: 0,
                    primitiveLength: 2,
                    primitiveOffset: 0,
                }
            ],
            segmentsLines: [
                {
                    vertexOffset: 0,
                    primitiveLength: 4,
                    primitiveOffset: 0,
                }
            ]
        };

        // Check string representation
        const stringsA = getRenderedGeometryRepresentation(meshA);
        expect(stringsA.stringsTriangles).toEqual(['(0 0) (0 1) (1 0)', '(0 1) (1 1) (1 0)']);
        expect(stringsA.stringsLines).toEqual(['(0 0) (1 0)', '(1 0) (1 1)', '(1 1) (0 1)', '(0 1) (0 0)']);

        const meshB: SimpleMesh = {
            vertices: [
                0, 0, // 0
                0, 1, // 1
                1, 0, // 2
                0, 1, // 3
                1, 1, // 4
                1, 0, // 5
                0, 0,
                1, 0,
                1, 1,
                0, 1,
            ],
            indicesTriangles: [
                0, 1, 2,
                0, 1, 2
            ],
            indicesLines: [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ],
            segmentsTriangles: [
                {
                    vertexOffset: 0,
                    primitiveLength: 1,
                    primitiveOffset: 0,
                },
                {
                    vertexOffset: 3,
                    primitiveLength: 1,
                    primitiveOffset: 1,
                }
            ],
            segmentsLines: [
                {
                    vertexOffset: 6,
                    primitiveLength: 4,
                    primitiveOffset: 0,
                }
            ]
        };

        testMeshesEqual(meshA, meshB);

        // same as mesh A, but contains one error
        const meshC: SimpleMesh = {
            vertices: [
                0, 0, // 0       0 ---- 1
                1, 0, // 1       |      |
                1, 1, // 2       |      |
                0, 1  // 3       3 ---- 2
            ],
            indicesTriangles: [
                0, 3, 1,
                1, 2, 3 // flip vertex order
            ],
            indicesLines: [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ],
            segmentsTriangles: [
                {
                    vertexOffset: 0,
                    primitiveLength: 2,
                    primitiveOffset: 0,
                }
            ],
            segmentsLines: [
                {
                    vertexOffset: 0,
                    primitiveLength: 4,
                    primitiveOffset: 0,
                }
            ]
        };
        const stringsC = getRenderedGeometryRepresentation(meshC);
        // String representations should be different
        expect(stringsC.stringsTriangles).not.toEqual(stringsA.stringsTriangles);
    });

    test('Mesh grid generation', () => {
        const mesh = getGridMesh(2);
        const strings = getRenderedGeometryRepresentation(mesh);
        // Note that this forms a correct 2x2 quad mesh.
        expect(strings.stringsTriangles).toEqual([
            '(0 0) (1 1) (1 0)',
            '(0 0) (0 1) (1 1)',
            '(1 0) (2 1) (2 0)',
            '(1 0) (1 1) (2 1)',
            '(0 1) (1 2) (1 1)',
            '(0 1) (0 2) (1 2)',
            '(1 1) (2 2) (2 1)',
            '(1 1) (1 2) (2 2)'
        ]);
        expect(strings.stringsLines).toEqual([
            '(0 0) (1 0)',
            '(1 0) (2 0)',
            '(0 2) (1 2)',
            '(1 2) (2 2)',
            '(0 0) (0 1)',
            '(0 1) (0 2)',
            '(2 0) (2 1)',
            '(2 1) (2 2)'
        ]);
    });

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

function splitMesh(mesh: SimpleMesh): SimpleMesh {
    const segmentsTriangles = new SegmentVector();
    const segmentsLines = new SegmentVector();

    const virtualVertices = new VirtualVertexBuffer();
    const virtualIndicesTriangles = new VirtualIndexBufferTriangles();
    const virtualIndicesLines = new VirtualIndexBufferLines();

    fillLargeMeshArrays(
        (x, y) => {
            virtualVertices.emplaceBack(x, y);
        },
        segmentsTriangles,
        virtualVertices as any as StructArray,
        virtualIndicesTriangles as any as TriangleIndexArray,
        mesh.vertices,
        mesh.indicesTriangles,
        segmentsLines,
        virtualIndicesLines as any as LineIndexArray,
        [mesh.indicesLines]);

    return {
        segmentsTriangles: segmentsTriangles.segments,
        segmentsLines: segmentsLines.segments,
        vertices: virtualVertices.data,
        indicesTriangles: virtualIndicesTriangles.data,
        indicesLines: virtualIndicesLines.data
    };
}

/**
 * Our goal is to check that a mesh (in this context, a mesh is a vertex buffer, index buffer and segment vector)
 * with potentially more than `SegmentVector.MAX_VERTEX_ARRAY_LENGTH` vertices results in the same rendered geometry
 * as the result of passing that mesh through `fillLargeMeshArrays`, which creates a mesh that respects the vertex count limit.
 * @param expected - The original mesh that might overflow the vertex count limit.
 * @param actual - The result of passing the original mesh through `fillLargeMeshArrays`.
 */
function testMeshesEqual(expected: SimpleMesh, actual: SimpleMesh) {
    const stringsExpected = getRenderedGeometryRepresentation(expected);
    const stringsActual = getRenderedGeometryRepresentation(actual);
    expect(stringsActual.stringsTriangles).toEqual(stringsExpected.stringsTriangles);
    expect(stringsActual.stringsLines).toEqual(stringsExpected.stringsLines);
}

/**
 * Returns an ordered string representation of the geometry that would be fetched by the GPU's vertex fetch
 * if it were to draw the specified mesh segments, respecting `vertexOffset` and `primitiveOffset`.
 */
function getRenderedGeometryRepresentation(mesh: SimpleMesh) {
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
