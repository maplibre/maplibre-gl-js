import {describe, expect, test} from 'vitest';
import {shaders} from './shaders.ts';

describe('shaders', () => {
    /** `flat` varyings make ANGLE's Metal backend rewrite the index buffer of a draw: https://issues.angleproject.org/issues/558254910 */
    test('avoids flat varyings for Safari compatibility', () => {
        for (const [name, {vertexSource, fragmentSource}] of Object.entries(shaders)) {
            expect(vertexSource, `${name} vertex shader`).not.toMatch(/\bflat\b/);
            expect(fragmentSource, `${name} fragment shader`).not.toMatch(/\bflat\b/);
        }
    });
});
