
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


        transform.setCenter(new LngLat(-50, -30));
        
        // With bounds [-5, -5, 5, 5], setting center to (-50, -30) should be clamped.
        
        const center = transform.center;
        
        // WE EXPECT this to be clamped to roughly (-5, -5) range.
        expect(center.lng).toBeGreaterThanOrEqual(-5);
        expect(center.lng).toBeLessThanOrEqual(5);
        expect(center.lat).toBeGreaterThanOrEqual(-5);
        expect(center.lat).toBeLessThanOrEqual(5);
    });



    test('maxBounds constrain zoom to cover viewport', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(1000, 1000);

        // Set maxBounds to a small area (e.g. 10x10 degrees)
        const bounds = new LngLatBounds([-5, -5, 5, 5]);
        transform.setMaxBounds(bounds);

        // Try to set zoom to 0 (which would show the whole world, violating the constraint of filling viewport with bounds)
        transform.setZoom(0);

        // The circumference at lat 0 is equal to worldSize (512 * scale).
        // Bounds width is 10 degrees = 10/360 * circumference.
        // We want bounds width to be at least viewport width (1000px).
        // (10/360) * (512 * scale) >= 1000
        // scale >= (1000 * 360) / (10 * 512) = 360000 / 5120 ≈ 70.3
        // zoom = log2(70.3) ≈ 6.13
        
        // So we expect zoom to be constrained to something > 6.
        expect(transform.zoom).toBeGreaterThan(6);
        expect(transform.zoom).toBeLessThan(7); // Tight bound check
    });

    test('maxBounds do not increase zoom if bounds already cover viewport', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        
        // Large bounds
        transform.setMaxBounds(new LngLatBounds([-50, -50, 50, 50]));

        // Set zoom to something reasonable
        transform.setZoom(5);
        const originalZoom = transform.zoom;

        // Re-applying the same max bounds shouldn't force zoom change if it's already satisfied
        const constrained = transform.defaultConstrain(transform.center, transform.zoom);
        
        expect(constrained.zoom).toBeCloseTo(originalZoom, 4);
    });
});

