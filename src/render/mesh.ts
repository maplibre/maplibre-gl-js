import {type SegmentVector} from '../data/segment.ts';
import {type VertexBuffer} from '../webgl/vertex_buffer.ts';
import {type IndexBuffer} from '../webgl/index_buffer.ts';

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
