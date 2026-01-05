
import {describe, test, expect} from 'vitest';
import {LngLat} from '../lng_lat';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import {LngLatBounds} from '../lng_lat_bounds';

describe('VerticalPerspectiveTransform', () => {
    test('lngRange & latRange constrain zoom and center', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(10);
        transform.resize(500, 500);

        transform.setMaxBounds(new LngLatBounds([-5, -5, 5, 5]));

        // Before the fix, these assertions might fail or show unconstrained behavior if I were asserting strictly.
        // But here I'm writing the *desired* behavior to verify the fix.
        // If I run this NOW, it should fail if the logic is missing.

        transform.setCenter(new LngLat(-50, -30));
        
        // With bounds [-5, -5, 5, 5], setting center to (-50, -30) should be clamped.
        // The exact clamped value depends on the implementation, but it definitely shouldn't be (-50, -30).
        // Since globe implementation of `defaultConstrain` currently ignores bounds, it will likely remain (-50, -30).
        
        const center = transform.center;
        
        // WE EXPECT this to be clamped to roughly (-5, -5) range.
        expect(center.lng).toBeGreaterThanOrEqual(-5);
        expect(center.lng).toBeLessThanOrEqual(5);
        expect(center.lat).toBeGreaterThanOrEqual(-5);
        expect(center.lat).toBeLessThanOrEqual(5);
    });
});

// Trigger CI
