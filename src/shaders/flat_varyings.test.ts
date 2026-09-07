import {describe, expect, test} from 'vitest';
import {shaders} from './shaders';

/**
 * No shader may declare a `flat` varying.
 *
 * ANGLE's Metal backend cannot express OpenGL's provoking-vertex rule for
 * flat shading directly (GL takes the last vertex of a primitive, Metal the
 * first), so for every draw that uses a `flat` varying it rewrites the index
 * buffer and maps it straight back — a GPU→CPU sync per draw
 * (https://issues.chromium.org/issues/40286880). On iPadOS 16 Safari that
 * hangs the GPU process outright (#8002). Every varying this library passes
 * is constant across its primitive anyway, so interpolating it costs nothing
 * and changes nothing.
 */
describe('shader varyings', () => {
    test('are never declared flat', () => {
        for (const [name, {vertexSource, fragmentSource}] of Object.entries(shaders)) {
            expect(vertexSource, `${name} vertex shader`).not.toMatch(/\bflat\s+(in|out)\b/);
            expect(fragmentSource, `${name} fragment shader`).not.toMatch(/\bflat\s+(in|out)\b/);
        }
    });
});
