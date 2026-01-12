
import {describe, test, expect} from 'vitest';
import {LngLat} from '../lng_lat';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import {LngLatBounds} from '../lng_lat_bounds';

describe('VerticalPerspectiveTransform', () => {
    test('constrains center to maxBounds', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(10);
        transform.resize(500, 500);

        transform.setMaxBounds(new LngLatBounds([-5, -5, 5, 5]));
        transform.setCenter(new LngLat(-50, -30));

        const center = transform.center;

        expect(center.lng).toBeGreaterThanOrEqual(-5);
        expect(center.lng).toBeLessThanOrEqual(5);
        expect(center.lat).toBeGreaterThanOrEqual(-5);
        expect(center.lat).toBeLessThanOrEqual(5);
    });

    test('handles maxBounds crossing antimeridian', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        // MaxBounds crossing antimeridian: 175 to -175 (10 degrees wide)
        transform.setMaxBounds(new LngLatBounds([175, -5, -175, 5]));
        
        // 1. Try to set center to 178 (valid)
        transform.setCenter(new LngLat(178, 0));
        expect(transform.center.lng).toBeCloseTo(178);

        // 2. Try to set center to -178 (valid)
        transform.setCenter(new LngLat(-178, 0));
        expect(transform.center.lng).toBeCloseTo(-178);

        // 3. Try to set center to 170 (invalid, close to 175)
        transform.setCenter(new LngLat(170, 0));
        expect(transform.center.lng).toBeCloseTo(175);
    });

    test('constrains zoom to cover viewport when maxBounds is set', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(1000, 1000);

        // Set maxBounds to a small area (e.g. 10x10 degrees)
        const bounds = new LngLatBounds([-5, -5, 5, 5]);
        transform.setMaxBounds(bounds);

        // Try to set zoom to 0
        transform.setZoom(0);

        // Expected behavior: map ZOOMS IN to fit the bounds into the viewport (approximately)
        // With 10 degrees span and 1000px width, zoom should be around:
        // log2(1000 * 360 / (512 * 10)) = log2(360000 / 5120) = log2(70.3) ~= 6.13
        expect(transform.zoom).toBeGreaterThan(5);

    });

    test('preserves zoom if maxBounds already cover viewport', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        
        transform.setMaxBounds(new LngLatBounds([-50, -50, 50, 50]));
        transform.setZoom(5);
        const originalZoom = transform.zoom;

        const constrained = transform.defaultConstrain(transform.center, transform.zoom);
        
        expect(constrained.zoom).toBeCloseTo(originalZoom, 4);
    });
});

