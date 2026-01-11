
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

    test('constrains zoom to cover viewport when maxBounds is set', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(1000, 1000);

        // Set maxBounds to a small area (e.g. 10x10 degrees)
        const bounds = new LngLatBounds([-5, -5, 5, 5]);
        transform.setMaxBounds(bounds);

        // Try to set zoom to 0 (which would show the whole world, violating the constraint of filling viewport with bounds)
        transform.setZoom(0);

        // Expected minimum zoom for 1000px viewport and 10 degrees is approx 6.13
        expect(transform.zoom).toBeGreaterThan(6);
        expect(transform.zoom).toBeLessThan(7);
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

