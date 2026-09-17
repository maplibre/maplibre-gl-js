import {describe, test, expect, beforeEach, vi} from 'vitest';
import {Context} from './context.ts';
import {createNullGL} from '../util/test/null_gl.ts';

import type {RendererProjectionData} from '../geo/projection/projection_data.ts';

function projectionData(uniformBufferKey?: string): RendererProjectionData {
    return {
        mainMatrix: new Float32Array(16),
        fallbackMatrix: new Float32Array(16),
        tileMercatorCoords: [0, 0, 1, 1],
        clippingPlane: [0, 0, 0, 0],
        projectionTransition: 0,
        clipAntimeridian: false,
        uniformBufferKey
    };
}

describe('ProjectionUniformBufferPool', () => {
    let gl: WebGL2RenderingContext;
    let context: Context;

    beforeEach(() => {
        gl = createNullGL();
        context = new Context(gl);
        vi.mocked(gl.bufferData).mockClear();
        vi.mocked(gl.bindBufferBase).mockClear();
    });

    test('uploads each key once per frame and rebinds on later use, and never reuses an unkeyed upload', () => {
        const pool = context.projectionUniformBufferPool;

        // First frame allocates the buffers, which uploads too, so measure from the second frame on.
        pool.beginFrame();
        pool.use(projectionData('a'));
        pool.use(projectionData('b'));

        vi.mocked(gl.bufferData).mockClear();
        vi.mocked(gl.bindBufferBase).mockClear();
        pool.beginFrame();
        pool.use(projectionData('a'));
        pool.use(projectionData('b'));
        pool.use(projectionData('a'));
        pool.use(projectionData('b'));
        expect(gl.bufferData).toHaveBeenCalledTimes(2);
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(4);

        // Unkeyed data shares one buffer, so it has to be rewritten and rebound even when the contents repeat.
        vi.mocked(gl.bufferData).mockClear();
        vi.mocked(gl.bindBufferBase).mockClear();
        pool.use(projectionData());
        pool.use(projectionData());
        expect(gl.bufferData).toHaveBeenCalledTimes(2);
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(2);
    });

    test('releases buffers that no frame has used for a while', () => {
        const pool = context.projectionUniformBufferPool;
        pool.beginFrame();
        pool.use(projectionData('a'));
        vi.mocked(gl.deleteBuffer).mockClear();

        for (let i = 0; i < 61; i++) pool.beginFrame();
        expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);

        pool.use(projectionData('a'));
        expect(gl.bufferData).toHaveBeenCalled();
    });
});
