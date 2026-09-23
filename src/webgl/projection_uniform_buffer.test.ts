import {describe, test, expect, vi} from 'vitest';
import {Context} from './context.ts';
import {bindProjectionUniformBuffer, destroyProjectionUniformBuffers, releaseProjectionUniformBuffers} from './projection_uniform_buffer.ts';
import {UBO_BINDINGS} from './uniform_buffer.ts';
import {createNullGL} from '../util/test/null_gl.ts';

import type {RendererProjectionData} from '../geo/projection/projection_data.ts';

function createProjectionData(uniformBufferKey: string, projectionTransition: number): RendererProjectionData {
    return {
        mainMatrix: new Float32Array(16),
        fallbackMatrix: new Float32Array(16),
        tileMercatorCoords: [0, 0, 1, 1],
        clippingPlane: [0, 0, 0, 0],
        projectionTransition,
        clipAntimeridian: false,
        uniformBufferKey
    };
}

describe('bindProjectionUniformBuffer', () => {
    test('rebinds the buffer of a key without uploading it again in the same frame', () => {
        const gl = createNullGL();
        const context = new Context(gl);
        bindProjectionUniformBuffer(context, createProjectionData('a', 0));
        const buffer = vi.mocked(gl.bindBufferBase).mock.lastCall[2];
        bindProjectionUniformBuffer(context, createProjectionData('b', 1));
        vi.mocked(gl.bindBufferBase).mockClear();
        vi.mocked(gl.bufferData).mockClear();

        bindProjectionUniformBuffer(context, createProjectionData('a', 0));

        expect(gl.bufferData).not.toHaveBeenCalled();
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(1);
        expect(gl.bindBufferBase).toHaveBeenCalledWith(gl.UNIFORM_BUFFER, UBO_BINDINGS.ProjectionUBO, buffer);
    });
});

describe('releaseProjectionUniformBuffers', () => {
    test('reuses the buffers of the previous frame and uploads them again', () => {
        const gl = createNullGL();
        const context = new Context(gl);
        bindProjectionUniformBuffer(context, createProjectionData('a', 0));
        const buffer = vi.mocked(gl.bindBufferBase).mock.lastCall[2];
        releaseProjectionUniformBuffers(context);
        vi.mocked(gl.createBuffer).mockClear();
        vi.mocked(gl.bindBufferBase).mockClear();
        vi.mocked(gl.bufferData).mockClear();

        bindProjectionUniformBuffer(context, createProjectionData('a', 1));

        expect(gl.createBuffer).not.toHaveBeenCalled();
        expect(gl.bufferData).toHaveBeenCalledTimes(1);
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(1);
        expect(gl.bindBufferBase).toHaveBeenCalledWith(gl.UNIFORM_BUFFER, UBO_BINDINGS.ProjectionUBO, buffer);
    });
});

describe('destroyProjectionUniformBuffers', () => {
    test('deletes every projection buffer once, even when called twice', () => {
        const gl = createNullGL();
        const context = new Context(gl);
        const sharedBuffer = context.projectionUniformBuffer.buffer;
        bindProjectionUniformBuffer(context, createProjectionData('a', 0));
        bindProjectionUniformBuffer(context, createProjectionData('b', 1));
        releaseProjectionUniformBuffers(context);
        bindProjectionUniformBuffer(context, createProjectionData('c', 0));
        vi.mocked(gl.deleteBuffer).mockClear();

        destroyProjectionUniformBuffers(context);
        destroyProjectionUniformBuffers(context);

        expect(gl.deleteBuffer).toHaveBeenCalledTimes(3);
        expect(gl.deleteBuffer).toHaveBeenCalledWith(sharedBuffer);
    });
});
