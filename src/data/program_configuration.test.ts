import {describe, test, expect, vi} from 'vitest';
import {ProgramConfiguration} from './program_configuration.ts';
import {LineStyleLayer} from '../style/style_layer/line_style_layer.ts';
import {Uniform4f} from '../webgl/uniform_binding.ts';

import type {Context} from '../webgl/context.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../style/zoom_history.ts';

function createDashedLineProgramConfiguration() {
    const layer = new LineStyleLayer({
        id: 'line',
        type: 'line',
        source: 'source',
        paint: {'line-dasharray': [2, 1]}
    }, {});
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return {layer, programConfiguration: new ProgramConfiguration(layer, 0, () => true)};
}

function createUniform() {
    const gl = {uniform4f: vi.fn()};
    return {gl, uniform: new Uniform4f({gl} as unknown as Context, null)};
}

describe('CrossFadedConstantBinder', () => {
    test.each(['u_dasharray_to', 'u_dasharray_from'])('setUniform does not throw for %s when dash positions were never set', (name) => {
        const {layer, programConfiguration} = createDashedLineProgramConfiguration();
        const {gl, uniform} = createUniform();

        expect(() => programConfiguration.setUniforms(
            null,
            [{name, property: 'line-dasharray', binding: uniform}],
            layer.paint,
            {zoom: 0}
        )).not.toThrow();
        expect(gl.uniform4f).not.toHaveBeenCalled();
    });
});
