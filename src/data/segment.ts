import {warnOnce} from '../util/util';

import {register} from '../util/web_worker_transfer';

import type {VertexArrayObject} from '../render/vertex_array_object';
import type {StructArray} from '../util/struct_array';

/**
 * @internal
 * A single segment of a vector
 */
export type Segment = {
    sortKey?: number;
    vertexOffset: number;
    primitiveOffset: number;
    vertexLength: number;
    primitiveLength: number;
    vaos: {[_: string]: VertexArrayObject};
};

/**
 * @internal
 * Used for calculations on vector segments
 */
export class SegmentVector {
    static MAX_VERTEX_ARRAY_LENGTH: number;
    segments: Array<Segment>;
    private _forceNewSegmentOnNextPrepare: boolean = false;

    constructor(segments: Array<Segment> = []) {
        this.segments = segments;
    }

    /**
     * Returns the last segment if `numVertices` fits into it.
     * If there are no segments yet or `numVertices` doesn't fit into the last one, creates a new empty segment and returns it.
     */
    prepareSegment(
        numVertices: number,
        layoutVertexArray: StructArray,
        indexArray: StructArray,
        sortKey?: number
    ): Segment {
        const lastSegment: Segment = this.segments[this.segments.length - 1];

        if (numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            warnOnce(`Max vertices per segment is ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH}: bucket requested ${numVertices}. Consider using the \`fillLargeMeshArrays\` function if you require meshes with more than ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH} vertices.`);
        }

        if (this._forceNewSegmentOnNextPrepare || !lastSegment || lastSegment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH || lastSegment.sortKey !== sortKey) {
            return this.createNewSegment(layoutVertexArray, indexArray, sortKey);
        } else {
            return lastSegment;
        }
    }

    /**
     * Creates a new empty segment and returns it.
     */
    createNewSegment(
        layoutVertexArray: StructArray,
        indexArray: StructArray,
        sortKey?: number
    ): Segment {
        const segment: Segment = {
            vertexOffset: layoutVertexArray.length,
            primitiveOffset: indexArray.length,
            vertexLength: 0,
            primitiveLength: 0,
            vaos: {}
        };

        if (sortKey !== undefined) {
            segment.sortKey = sortKey;
        }

        // If this was set, we have no need to create a new segment on next prepareSegment call,
        // since this function already created a new, empty segment.
        this._forceNewSegmentOnNextPrepare = false;
        this.segments.push(segment);
        return segment;
    }

    /**
     * Returns the last segment, or creates a new segments if there are no segments yet.
     */
    getOrCreateLatestSegment(
        layoutVertexArray: StructArray,
        indexArray: StructArray,
        sortKey?: number
    ): Segment {
        return this.prepareSegment(0, layoutVertexArray, indexArray, sortKey);
    }

    /**
     * Causes the next call to {@link prepareSegment} to always return a new segment,
     * not reusing the current segment even if the new geometry would fit it.
     */
    forceNewSegmentOnNextPrepare() {
        this._forceNewSegmentOnNextPrepare = true;
    }

    get() {
        return this.segments;
    }

    destroy() {
        for (const segment of this.segments) {
            for (const k in segment.vaos) {
                segment.vaos[k].destroy();
            }
        }
    }

    static simpleSegment(
        vertexOffset: number,
        primitiveOffset: number,
        vertexLength: number,
        primitiveLength: number
    ): SegmentVector {
        return new SegmentVector([{
            vertexOffset,
            primitiveOffset,
            vertexLength,
            primitiveLength,
            vaos: {},
            sortKey: 0
        }]);
    }
}

/**
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 */
SegmentVector.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;

register('SegmentVector', SegmentVector);
