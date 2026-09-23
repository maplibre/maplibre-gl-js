import {describe, test, expect, vi} from 'vitest';
import {Context} from './context.ts';
import {bindProjectionUniformBuffer} from './projection_uniform_buffer.ts';
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
