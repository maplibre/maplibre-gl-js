import {type LineIndexArray, type TriangleIndexArray} from '../data/array_types.g';
import {type Segment, SegmentVector} from '../data/segment';
import {type StructArray} from '../util/struct_array';

/**
 * This function will take any "mesh" and fill in into vertex buffers, breaking it up into multiple drawcalls as needed
 * if too many (\>65535) vertices are used.
 * This function is mainly intended for use with subdivided geometry, since sometimes subdivision might generate
 * more vertices than what fits into 16 bit indices.
 *
 * Accepts a triangle mesh, optionally with a line list (for fill outlines) as well. The triangle and line segments are expected to share a single vertex buffer.
 *
 * Mutates the provided `segmentsTriangles` and `segmentsLines` SegmentVectors,
 * `vertexArray`, `triangleIndexArray` and optionally `lineIndexArray`.
 * Does not mutate the input `flattened` vertices, `triangleIndices` and `lineList`.
 * @param addVertex - A function for adding a new vertex into `vertexArray`. We might sometimes want to add more values per vertex than just X and Y coordinates, which can be handled in this function.
 * @param segmentsTriangles - The segment array for triangle draw calls. New segments will be placed here.
 * @param vertexArray - The vertex array into which new vertices are placed by the provided `addVertex` function.
 * @param triangleIndexArray - Index array for drawing triangles. New triangle indices are placed here.
 * @param flattened - The input flattened array or vertex coordinates.
 * @param triangleIndices - Triangle indices into `flattened`.
 * @param segmentsLines - Segment array for line draw calls. New segments will be placed here. Only needed if the mesh also contains lines.
 * @param lineIndexArray - Index array for drawing lines. New triangle indices are placed here. Only needed if the mesh also contains lines.
 * @param lineList - Line indices into `flattened`. Only needed if the mesh also contains lines.
 */
export function fillLargeMeshArrays(
    addVertex: (x: number, y: number) => void,
    segmentsTriangles: SegmentVector,
    vertexArray: StructArray,
    triangleIndexArray: TriangleIndexArray,
    flattened: Array<number>,
    triangleIndices: Array<number>,
    segmentsLines?: SegmentVector,
    lineIndexArray?: LineIndexArray,
    lineList?: Array<Array<number>>) {

    const numVertices = flattened.length / 2;
    const hasLines = segmentsLines && lineIndexArray && lineList;

    if (numVertices < SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
        // The fast path - no segmentation needed
        const triangleSegment = segmentsTriangles.prepareSegment(numVertices, vertexArray, triangleIndexArray);
        const triangleIndex = triangleSegment.vertexLength;

        for (let i = 0; i < triangleIndices.length; i += 3) {
            triangleIndexArray.emplaceBack(
                triangleIndex + triangleIndices[i],
                triangleIndex + triangleIndices[i + 1],
                triangleIndex + triangleIndices[i + 2]);
        }

        triangleSegment.vertexLength += numVertices;
        triangleSegment.primitiveLength += triangleIndices.length / 3;

        let lineIndicesStart: number;
        let lineSegment: Segment;

        if (hasLines) {
            // Note that segment creation must happen *before* we add vertices into the vertex buffer
            lineSegment = segmentsLines.prepareSegment(numVertices, vertexArray, lineIndexArray);
            lineIndicesStart = lineSegment.vertexLength;
            lineSegment.vertexLength += numVertices;
        }

        // Add vertices into vertex buffer
        for (let i = 0; i < flattened.length; i += 2) {
            addVertex(flattened[i], flattened[i + 1]);
        }

        if (hasLines) {
            for (let listIndex = 0; listIndex < lineList.length; listIndex++) {
                const lineIndices = lineList[listIndex];

                for (let i = 1; i < lineIndices.length; i += 2) {
                    lineIndexArray.emplaceBack(
                        lineIndicesStart + lineIndices[i - 1],
                        lineIndicesStart + lineIndices[i]);
                }

                lineSegment.primitiveLength += lineIndices.length / 2;
            }
        }
    } else {
        // Assumption: the incoming triangle indices use vertices in roughly linear order,
        // for example a grid of quads where both vertices and quads are created row by row would satisfy this.
        // Some completely random arbitrary vertex/triangle order would not.
        // Thus, if we encounter a vertex that doesn't fit into MAX_VERTEX_ARRAY_LENGTH,
        // we can just stop appending into the old segment and start a new segment and only append to the new segment,
        // copying vertices that are already present in the old segment into the new segment if needed,
        // because there will not be too many of such vertices.

        // Normally, (out)lines share the same vertex buffer as triangles, but since we need to somehow split it into several drawcalls,
        // it is easier to just consider (out)lines separately and duplicate their vertices.

        fillSegmentsTriangles(segmentsTriangles, vertexArray, triangleIndexArray, flattened, triangleIndices, addVertex);
        if (hasLines) {
            fillSegmentsLines(segmentsLines, vertexArray, lineIndexArray, flattened, lineList, addVertex);
        }

        // Triangles and lines share the same vertex buffer, and they usually also share the same vertices.
        // But this method might create the vertices for triangles and for lines separately, and thus increasing the vertex count
        // of the triangle and line segments by different amounts.

        // The non-splitting fillLargeMeshArrays logic (and old fill-bucket logic) assumes the vertex counts to be the same,
        // and forcing both SegmentVectors to return a new segment upon next prepare call satisfies this.
        segmentsTriangles.forceNewSegmentOnNextPrepare();
        segmentsLines?.forceNewSegmentOnNextPrepare();
    }
}

/**
 * Determines the new index of a vertex given by its old index.
 * @param actualVertexIndices - Array that maps the old index of a given vertex to a new index in the final vertex buffer.
 * @param flattened - Old vertex buffer.
 * @param addVertex - Function for creating a new vertex in the final vertex buffer.
 * @param totalVerticesCreated - Reference to an int holding how many vertices were added to the final vertex buffer.
 * @param oldIndex - The old index of the desired vertex.
 * @param needsCopy - Whether to duplicate the desired vertex in the final vertex buffer.
 * @param segment - The current segment.
 * @returns Index of the vertex in the final vertex array.
 */
function copyOrReuseVertex(
    actualVertexIndices: Array<number>,
    flattened: Array<number>,
    addVertex: (x: number, y: number) => void,
    totalVerticesCreated: {count: number},
    oldIndex: number,
    needsCopy: boolean,
    segment: Segment
): number {
    if (needsCopy) {
        const newIndex = totalVerticesCreated.count;
        addVertex(flattened[oldIndex * 2], flattened[oldIndex * 2 + 1]);
        actualVertexIndices[oldIndex] = totalVerticesCreated.count;
        totalVerticesCreated.count++;
        segment.vertexLength++;
        return newIndex;
    } else {
        return actualVertexIndices[oldIndex];
    }
}

function fillSegmentsTriangles(
    segmentsTriangles: SegmentVector,
    vertexArray: StructArray,
    triangleIndexArray: TriangleIndexArray,
    flattened: Array<number>,
    triangleIndices: Array<number>,
    addVertex: (x: number, y: number) => void
) {
    // Array, or rather a map of [vertex index in the original data] -> index of the latest copy of this vertex in the final vertex buffer.
    const actualVertexIndices: Array<number> = [];
    for (let i = 0; i < flattened.length / 2; i++) {
        actualVertexIndices.push(-1);
    }

    const totalVerticesCreated = {count: 0};

    let currentSegmentCutoff = 0;
    let segment = segmentsTriangles.getOrCreateLatestSegment(vertexArray, triangleIndexArray);
    let baseVertex = segment.vertexLength;

    for (let primitiveEndIndex = 2; primitiveEndIndex < triangleIndices.length; primitiveEndIndex += 3) {
        const i0 = triangleIndices[primitiveEndIndex - 2];
        const i1 = triangleIndices[primitiveEndIndex - 1];
        const i2 = triangleIndices[primitiveEndIndex];

        let i0needsVertexCopy = actualVertexIndices[i0] < currentSegmentCutoff;
        let i1needsVertexCopy = actualVertexIndices[i1] < currentSegmentCutoff;
        let i2needsVertexCopy = actualVertexIndices[i2] < currentSegmentCutoff;

        const vertexCopyCount = (i0needsVertexCopy ? 1 : 0) + (i1needsVertexCopy ? 1 : 0) + (i2needsVertexCopy ? 1 : 0);

        // Will needed vertex copies fit into this segment?
        if (segment.vertexLength + vertexCopyCount > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            // Break up into a new segment if not.
            segment = segmentsTriangles.createNewSegment(vertexArray, triangleIndexArray);
            currentSegmentCutoff = totalVerticesCreated.count;
            i0needsVertexCopy = true;
            i1needsVertexCopy = true;
            i2needsVertexCopy = true;
            baseVertex = 0;
        }

        const actualIndex0 = copyOrReuseVertex(
            actualVertexIndices, flattened, addVertex, totalVerticesCreated,
            i0, i0needsVertexCopy, segment);
        const actualIndex1 = copyOrReuseVertex(
            actualVertexIndices, flattened, addVertex, totalVerticesCreated,
            i1, i1needsVertexCopy, segment);
        const actualIndex2 = copyOrReuseVertex(
            actualVertexIndices, flattened, addVertex, totalVerticesCreated,
            i2, i2needsVertexCopy, segment);

        triangleIndexArray.emplaceBack(
            baseVertex + actualIndex0 - currentSegmentCutoff,
            baseVertex + actualIndex1 - currentSegmentCutoff,
            baseVertex + actualIndex2 - currentSegmentCutoff
        );

        segment.primitiveLength++;
    }
}

function fillSegmentsLines(
    segmentsLines: SegmentVector,
    vertexArray: StructArray,
    lineIndexArray: LineIndexArray,
    flattened: Array<number>,
    lineList: Array<Array<number>>,
    addVertex: (x: number, y: number) => void
) {
    // Array, or rather a map of [vertex index in the original data] -> index of the latest copy of this vertex in the final vertex buffer.
    const actualVertexIndices: Array<number> = [];
    for (let i = 0; i < flattened.length / 2; i++) {
        actualVertexIndices.push(-1);
    }

    const totalVerticesCreated = {count: 0};

    let currentSegmentCutoff = 0;
    let segment = segmentsLines.getOrCreateLatestSegment(vertexArray, lineIndexArray);
    let baseVertex = segment.vertexLength;

    for (let lineListIndex = 0; lineListIndex < lineList.length; lineListIndex++) {
        const currentLine = lineList[lineListIndex];
        for (let lineVertex = 1; lineVertex < lineList[lineListIndex].length; lineVertex += 2) {
            const i0 = currentLine[lineVertex - 1];
            const i1 = currentLine[lineVertex];

            let i0needsVertexCopy = actualVertexIndices[i0] < currentSegmentCutoff;
            let i1needsVertexCopy = actualVertexIndices[i1] < currentSegmentCutoff;

            const vertexCopyCount = (i0needsVertexCopy ? 1 : 0) + (i1needsVertexCopy ? 1 : 0);

            // Will needed vertex copies fit into this segment?
            if (segment.vertexLength + vertexCopyCount > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                // Break up into a new segment if not.
                segment = segmentsLines.createNewSegment(vertexArray, lineIndexArray);
                currentSegmentCutoff = totalVerticesCreated.count;
                i0needsVertexCopy = true;
                i1needsVertexCopy = true;
                baseVertex = 0;
            }

            const actualIndex0 = copyOrReuseVertex(
                actualVertexIndices, flattened, addVertex, totalVerticesCreated,
                i0, i0needsVertexCopy, segment);
            const actualIndex1 = copyOrReuseVertex(
                actualVertexIndices, flattened, addVertex, totalVerticesCreated,
                i1, i1needsVertexCopy, segment);

            lineIndexArray.emplaceBack(
                baseVertex + actualIndex0 - currentSegmentCutoff,
                baseVertex + actualIndex1 - currentSegmentCutoff
            );

            segment.primitiveLength++;
        }
    }
}
