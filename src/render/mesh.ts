import {SegmentVector} from '../data/segment';
import {VertexBuffer} from '../gl/vertex_buffer';
import {IndexBuffer} from '../gl/index_buffer';

export class Mesh {
    vertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;

    constructor(vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, segments: SegmentVector) {
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.segments = segments;
    }

    destroy(): void {
        this.vertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();

        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.segments = null;
    }
}
