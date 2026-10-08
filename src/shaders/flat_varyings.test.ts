import {describe, expect, test} from 'vitest';
import {shaders} from './shaders';

/**
 * Preserves the iPadOS 16 Safari rendering workaround by preventing accidental
 * reintroduction of `flat` varyings. ANGLE's fix for the cost of `flat` on Metal
 * only reaches browsers that ship it, so reintroducing them requires validation
 * on affected, supported Safari versions.
 *
 * Device reproduction: https://github.com/maplibre/maplibre-gl-js/pull/8364
 * ANGLE issue: https://issues.angleproject.org/issues/558254910
 * Merged ANGLE fix: https://chromium-review.googlesource.com/c/angle/angle/+/8361510
 */
describe('shader varyings', () => {
    test('avoids flat varyings for Safari compatibility', () => {
        for (const [name, {vertexSource, fragmentSource}] of Object.entries(shaders)) {
            expect(vertexSource, `${name} vertex shader`).not.toMatch(/\bflat\s+(in|out)\b/);
            expect(fragmentSource, `${name} fragment shader`).not.toMatch(/\bflat\s+(in|out)\b/);
        }
    });
});
