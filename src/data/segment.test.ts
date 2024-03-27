import {StructArray} from '../util/struct_array';
import {SegmentVector} from './segment';
import {VirtualIndexBufferTriangles, VirtualVertexBuffer} from '../../test/unit/lib/virtual_gl_buffers';

describe('SegmentVector', () => {
    test('constructor', () => {
        expect(new SegmentVector() instanceof SegmentVector).toBeTruthy();
    });

    test('simpleSegment', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const segmentVector = SegmentVector.simpleSegment(0, 0, 10, 0);
        expect(segmentVector instanceof SegmentVector).toBeTruthy();
        expect(segmentVector.segments).toHaveLength(1);
        expect(segmentVector.segments[0].vertexLength).toBe(10);
    });

    test('prepareSegment returns a segment', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const result = segmentVector.prepareSegment(10, vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        expect(result).toBeTruthy();
        expect(result.vertexLength).toBe(0);
    });

    test('prepareSegment handles vertex overflow', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 10);
        const second = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 10);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(first === second).toBe(false);
        expect(first.vertexLength).toBe(10);
        expect(second.vertexLength).toBe(10);
        expect(segmentVector.segments).toHaveLength(2);
    });

    test('prepareSegment reuses segments', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        const second = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(first === second).toBe(true);
        expect(first.vertexLength).toBe(10);
    });

    test('createNewSegment returns a new segment', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        const second = segmentVector.createNewSegment(vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        second.vertexLength += 5;
        vertexBuffer.addVertices(5);
        const third = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(third).toBeTruthy();
        expect(first === second).toBe(false);
        expect(second === third).toBe(true);
        expect(first.vertexLength).toBe(5);
        expect(third.vertexLength).toBe(10);
    });

    test('createNewSegment returns a new segment and resets invalidateLast', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        segmentVector.invalidateLast();
        const second = segmentVector.createNewSegment(vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        second.vertexLength += 5;
        vertexBuffer.addVertices(5);
        const third = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(third).toBeTruthy();
        expect(first === second).toBe(false);
        expect(second === third).toBe(true);
        expect(first.vertexLength).toBe(5);
        expect(third.vertexLength).toBe(10);
    });

    test('getOrCreateLatestSegment creates a new segment if SegmentVector was empty', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = segmentVector.getOrCreateLatestSegment(vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        expect(first).toBeTruthy();
        expect(segmentVector.segments).toHaveLength(1);
    });

    test('getOrCreateLatestSegment returns the last segment if invalidateLast=false', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        const second = segmentVector.getOrCreateLatestSegment(vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        second.vertexLength += 5;
        vertexBuffer.addVertices(5);
        const third = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(third).toBeTruthy();
        expect(first === second).toBe(true);
        expect(second === third).toBe(true);
        expect(first.vertexLength).toBe(15);
    });

    test('getOrCreateLatestSegment respects invalidateLast and returns a new segment', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        segmentVector.invalidateLast();
        const second = segmentVector.getOrCreateLatestSegment(vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
        second.vertexLength += 5;
        vertexBuffer.addVertices(5);
        const third = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(third).toBeTruthy();
        expect(first === second).toBe(false);
        expect(second === third).toBe(true);
        expect(first.vertexLength).toBe(5);
        expect(third.vertexLength).toBe(10);
    });

    test('prepareSegment respects invalidateLast', () => {
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 16;
        const vertexBuffer = new VirtualVertexBuffer();
        const indexBuffer = new VirtualIndexBufferTriangles();
        const segmentVector = new SegmentVector();
        const first = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        segmentVector.invalidateLast();
        const second = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        const third = mockUseSegment(segmentVector, vertexBuffer, indexBuffer, 5);
        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(third).toBeTruthy();
        expect(first === second).toBe(false);
        expect(second === third).toBe(true);
        expect(first.vertexLength).toBe(5);
        expect(second.vertexLength).toBe(10);
        expect(segmentVector.segments).toHaveLength(2);
    });
});

/**
 * Mocks the usage of a segment from SegmentVector. Returns the used segment.
 */
function mockUseSegment(segmentVector: SegmentVector, vertexBuffer: VirtualVertexBuffer, indexBuffer: VirtualIndexBufferTriangles, numVertices: number) {
    const seg = segmentVector.prepareSegment(numVertices, vertexBuffer as any as StructArray, indexBuffer as any as StructArray);
    seg.vertexLength += numVertices;
    vertexBuffer.addVertices(numVertices);
    return seg;
}
