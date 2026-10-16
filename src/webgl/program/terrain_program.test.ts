import {describe, expect, test} from 'vitest';
import {terrainUniformValues} from './terrain_program.ts';
import {Sky, calculateFogBlendOpacity} from '../../style/sky.ts';
import {mat4} from 'gl-matrix';

describe('terrainUniformValues', () => {
    test('disables fog when in globe projection mode', () => {
        const eleDelta = 1.0;
        const fogMatrix = mat4.create();
        const sky = new Sky({}, {}).getEvaluated();
        const pitch = 45;
        const isGlobeMode = true;
        const uniformValues = terrainUniformValues(eleDelta, fogMatrix, sky, pitch, isGlobeMode);

        expect(uniformValues['u_fog_ground_blend_opacity']).toBe(0);
        expect(uniformValues['u_ele_delta']).toBe(eleDelta);
        expect(uniformValues['u_fog_matrix']).toBe(fogMatrix);
        expect(uniformValues['u_fog_color']).toEqual(sky['fog-color']);
        expect(uniformValues['u_fog_ground_blend']).toBe(sky['fog-ground-blend']);
    });

    test('enables fog when not in globe projection mode', () => {
        const eleDelta = 1.0;
        const fogMatrix = mat4.create();
        const sky = new Sky({}, {}).getEvaluated();
        const pitch = 45;
        const isGlobeMode = false;
        const uniformValues = terrainUniformValues(eleDelta, fogMatrix, sky, pitch, isGlobeMode);
        expect(uniformValues['u_fog_ground_blend_opacity']).toBe(calculateFogBlendOpacity(pitch));
    });
});
