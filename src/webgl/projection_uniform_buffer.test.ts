import fs from 'fs';
import path from 'path';
import {describe, test, expect, beforeEach} from 'vitest';
import {Context} from './context.ts';
import {type ProjectionUniformBuffer, PROJECTION_UBO_MEMBERS} from './projection_uniform_buffer.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import type {ProjectionData} from '../geo/projection/projection_data.ts';

function sampleProjectionData(): ProjectionData {
    return {
        mainMatrix: new Float32Array(16),
        fallbackMatrix: new Float32Array(16),
        tileMercatorCoords: [1, 2, 3, 4],
        clippingPlane: [5, 6, 7, 8],
        projectionTransition: 0.5,
        clipAntimeridian: true,
    };
}

describe('ProjectionUniformBuffer', () => {
    let gl: WebGL2RenderingContext;
    let context: Context;
    let ubo: ProjectionUniformBuffer;

    beforeEach(() => {
        gl = createNullGL();
        context = new Context(gl);
        ubo = context.projectionUniformBuffer;
    });

    test('uploads only when data changes', () => {
        ubo.update(sampleProjectionData());
        ubo.update(sampleProjectionData());
        expect(gl.bufferSubData).toHaveBeenCalledTimes(1);

        const changed = sampleProjectionData();
        changed.projectionTransition = 0.75;
        ubo.update(changed);
        expect(gl.bufferSubData).toHaveBeenCalledTimes(2);

        changed.clipAntimeridian = false;
        ubo.update(changed);
        expect(gl.bufferSubData).toHaveBeenCalledTimes(3);
    });

    test('rebinds after setDirty', () => {
        ubo.update(sampleProjectionData());
        expect(gl.bindBufferBase).toHaveBeenCalledTimes(1);

        context.setDirty();
        ubo.update(sampleProjectionData());

        expect(gl.bindBufferBase).toHaveBeenCalledTimes(2);
        expect(gl.bufferSubData).toHaveBeenCalledTimes(1);
    });

    test('matches the shader preludes', () => {
        const readBlock = (file: string) => {
            const source = fs.readFileSync(path.join(__dirname, '../shaders/glsl', file), 'utf8');
            const block = source.match(/layout\(std140\) uniform ProjectionUBO \{([^}]*)\};/)[1];
            return block.split(';').map(s => s.trim()).filter(Boolean).map(decl => {
                const words = decl.split(/\s+/);
                return {name: words[words.length - 1], type: words[words.length - 2]};
            });
        };
        const expected = PROJECTION_UBO_MEMBERS.map(({name, type}) => ({name, type}));
        expect(readBlock('_prelude.vertex.glsl')).toEqual(expected);
        expect(readBlock('_prelude.fragment.glsl')).toEqual(expected);
    });
});
