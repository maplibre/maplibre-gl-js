import {describe, expect, test} from 'vitest';
import {FillLayoutArray, LineIndexArray, TriangleIndexArray} from '../data/array_types.g';
import {SegmentVector} from '../data/segment';
import {fillLargeMeshArrays} from './fill_large_mesh_arrays';
import {type SimpleMesh, getGridMesh, getGridMeshRandom} from '../../test/unit/lib/mesh_utils';

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
        const split = createSegmentsAndSplitMesh(mesh);
        expect(split.segmentsTriangles).toHaveLength(1);
        testMeshesEqual(mesh, split);
    });

    test('Small mesh is unchanged.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const mesh = getGridMesh(2);
        const split = createSegmentsAndSplitMesh(mesh);
        expect(split.segmentsTriangles).toHaveLength(1);
        testMeshesEqual(mesh, split);
    });

    test('Large mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const mesh = getGridMesh(4);
        const split = createSegmentsAndSplitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });

    test('Very large mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 1024;
        const mesh = getGridMesh(64);
        const split = createSegmentsAndSplitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });

    test('Very large random mesh is correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 1024;
        const mesh = getGridMeshRandom(64, 8192, 1024);
        const split = createSegmentsAndSplitMesh(mesh);
        expect(split.segmentsTriangles.length).toBeGreaterThan(1);
        testMeshesEqual(mesh, split);
    });

    test('Several small meshes are correctly placed into a single segment.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;

        const buffers = createMeshBuffers();

        const smallMesh = getGridMesh(1); // 4 vertices

        fillMesh(buffers, smallMesh);
        fillMesh(buffers, smallMesh);
        const result = convertBuffersToMesh(buffers);
        expect(result.vertices).toEqual([
            0, 0, // 0
            1, 0, // 1
            0, 1, // 2
            1, 1, // 3
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);
        expect(result.indicesTriangles).toEqual([
            0, 3, 1,
            0, 2, 3,
            4, 7, 5,
            4, 6, 7
        ]);
        expect(result.indicesLines).toEqual([
            0, 1, 2, 3, 0, 2, 1, 3,
            4, 5, 6, 7, 4, 6, 5, 7
        ]);
        expect(result.segmentsTriangles).toHaveLength(1);
        expect(result.segmentsLines).toHaveLength(1);
    });

    test('Several small and large meshes are correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;

        const buffers = createMeshBuffers();

        const smallMesh = getGridMesh(1); // 4 vertices
        const largeMesh = getGridMesh(2); // 9 vertices

        const meshList = [
            smallMesh,
            largeMesh,
            // Previous mesh still fits into first segment: 9+4 = 13
            largeMesh,
            // Only the first triangle fits, usage is second segment is 8 vertices
            smallMesh,
            // This last one brings up second segment usage to 12 vertices
        ];

        for (const mesh of meshList) {
            fillMesh(buffers, mesh);
        }

        const result = convertBuffersToMesh(buffers);
        const merge = mergeMeshes(meshList);

        expect(result.segmentsTriangles).toHaveLength(2);
        expect(result.segmentsTriangles[0].primitiveLength).toBe(10); // 2 + 8 triangles
        expect(result.segmentsTriangles[1].primitiveLength).toBe(10); // 8 + 2 triangles
        testMeshesEqual(merge, result);
    });

    test('Many small and large meshes are correctly split into multiple segments.', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;

        const buffers = createMeshBuffers();

        const smallMesh = getGridMesh(1); // 4 vertices
        const largeMesh = getGridMesh(2); // 9 vertices

        const meshList = [
            smallMesh,
            largeMesh,
            largeMesh,
            smallMesh,
            smallMesh,
            smallMesh,
            largeMesh,
            largeMesh,
            largeMesh,
            largeMesh,
            largeMesh,
        ];

        for (const mesh of meshList) {
            fillMesh(buffers, mesh);
        }

        const result = convertBuffersToMesh(buffers);
        const merge = mergeMeshes(meshList);
        testMeshesEqual(merge, result);
        expect(result.segmentsTriangles.length).toBeGreaterThan(merge.vertices.length / 2 / SegmentVector.MAX_VERTEX_ARRAY_LENGTH);
        expect(result.segmentsTriangles.length).toBeLessThan(meshList.length);
    });
});

type MeshBuffers = {
    segmentsTriangles: SegmentVector;
    segmentsLines: SegmentVector;
    vertices: FillLayoutArray;
    indicesTriangles: TriangleIndexArray;
    indicesLines: LineIndexArray;
};

function createMeshBuffers(): MeshBuffers {
    return {
        segmentsTriangles: new SegmentVector(),
        segmentsLines: new SegmentVector(),
        vertices: new FillLayoutArray(),
        indicesTriangles: new TriangleIndexArray(),
        indicesLines: new LineIndexArray(),
    };
}

/**
 * Creates a mesh the geometry of which is a merge of the specified input meshes,
 * useful for comparing the result of using {@link fillLargeMeshArrays} on several meshes.
 */
function mergeMeshes(meshes: Array<SimpleMesh>): SimpleMesh {
    const result: SimpleMesh = {
        vertices: [],
        indicesTriangles: [],
        indicesLines: [],
        segmentsTriangles: [],
        segmentsLines: [],
    };

    for (const mesh of meshes) {
        const baseVertex = result.vertices.length / 2;
        result.vertices.push(...mesh.vertices);
        result.indicesTriangles.push(...(mesh.indicesTriangles.map(x => x + baseVertex)));
        result.indicesLines.push(...(mesh.indicesLines.map(x => x + baseVertex)));
    }

    result.segmentsTriangles.push({
        vertexOffset: 0,
        primitiveOffset: 0,
        primitiveLength: result.indicesTriangles.length / 3,
    });
    result.segmentsLines.push({
        vertexOffset: 0,
        primitiveOffset: 0,
        primitiveLength: result.indicesLines.length / 2,
    });

    return result;
}

/**
 * Creates a mesh that is equal to the actual rendered output of a single
 * {@link fillLargeMeshArrays} call that is run in isolation.
 */
function createSegmentsAndSplitMesh(mesh: SimpleMesh): SimpleMesh {
    const buffers = createMeshBuffers();
    fillMesh(buffers, mesh);
    return convertBuffersToMesh(buffers);
}

function fillMesh(buffers: MeshBuffers, mesh: SimpleMesh): void {
    fillLargeMeshArrays(
        (x, y) => {
            buffers.vertices.emplaceBack(x, y);
        },
        buffers.segmentsTriangles,
        buffers.vertices,
        buffers.indicesTriangles,
        mesh.vertices,
        mesh.indicesTriangles,
        buffers.segmentsLines,
        buffers.indicesLines,
        [mesh.indicesLines]);
}

function convertBuffersToMesh(buffers: MeshBuffers): SimpleMesh {
    return {
        segmentsTriangles: buffers.segmentsTriangles.segments,
        segmentsLines: buffers.segmentsLines.segments,
        vertices: Array.from(buffers.vertices.int16).slice(0, buffers.vertices.length * 2),
        indicesTriangles: Array.from(buffers.indicesTriangles.uint16).slice(0, buffers.indicesTriangles.length * 3),
        indicesLines: Array.from(buffers.indicesLines.uint16).slice(0, buffers.indicesLines.length * 2)
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
