
import {describe, test, expect, beforeEach} from 'vitest';
import {LngLat} from '../lng_lat';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import {LngLatBounds} from '../lng_lat_bounds';

describe('VerticalPerspectiveTransform', () => {
    let transform: VerticalPerspectiveTransform;

    beforeEach(() => {
        transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
    });

    test('should constrain center latitude and longitude within maxBounds', () => {
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(10);
        transform.setMaxBounds(new LngLatBounds([-5, -5, 5, 5]));

        transform.setCenter(new LngLat(-50, -30));

        const center = transform.center;
        expect(center.lng).toBeGreaterThanOrEqual(-5);
        expect(center.lng).toBeLessThanOrEqual(5);
        expect(center.lat).toBeGreaterThanOrEqual(-5);
        expect(center.lat).toBeLessThanOrEqual(5);
    });

    test('should handle maxBounds crossing the antimeridian', () => {
        transform.setMaxBounds(new LngLatBounds([175, -5, -175, 5]));
        
        transform.setCenter(new LngLat(178, 0));
        expect(transform.center.lng).toBeCloseTo(178);

        transform.setCenter(new LngLat(-178, 0));
        expect(transform.center.lng).toBeCloseTo(-178);

        // Test the "gap"
        transform.setCenter(new LngLat(170, 0));
        expect(transform.center.lng).toBeCloseTo(175);

        transform.setCenter(new LngLat(-170, 0));
        expect(transform.center.lng).toBeCloseTo(-175);
    });

    test('should not stick at antimeridian when wrapping', () => {
        transform.setMaxBounds(new LngLatBounds([170, -10, -170, 10]));
        
        // Start East, move West across/near 180
        transform.setCenter(new LngLat(179, 0));
        expect(transform.center.lng).toBeCloseTo(179);

        // Move to -179 (crossing 180)
        transform.setCenter(new LngLat(-179, 0));
        expect(transform.center.lng).toBeCloseTo(-179);
        
        // Move back
        transform.setCenter(new LngLat(179, 0));
        expect(transform.center.lng).toBeCloseTo(179);
    });

    test('should maintain stable zoom when panning near bounds', () => {
        transform.resize(1000, 1000);
        // Bounds: Small area around Lat 45
        transform.setMaxBounds(new LngLatBounds([0, 40, 10, 50]));
        
        // Find the min zoom for these bounds at the center
        transform.setCenter(new LngLat(5, 45));
        transform.setZoom(0); // Force constraint logic to kick in
        const initialZoom = transform.zoom;
        
        // Pan slightly North (Lat increase)
        transform.setCenter(new LngLat(5, 45.1));
        transform.setZoom(0);
        const zoomNorth = transform.zoom;

        // Pan slightly South (Lat decrease)
        transform.setCenter(new LngLat(5, 44.9));
        transform.setZoom(0);
        const zoomSouth = transform.zoom;

        // Difference should be smooth/proportional, not "Jittery"
        const delta = Math.abs(zoomNorth - zoomSouth);
        expect(delta).toBeLessThan(0.1); 
        
        // Idempotency check
        const constrainedOnce = transform.defaultConstrain(transform.center, transform.zoom);
        const constrainedTwice = transform.defaultConstrain(constrainedOnce.center, constrainedOnce.zoom);
        expect(constrainedTwice.zoom).toBe(constrainedOnce.zoom);
    });

    test('should zoom in to fit bounds when maxBounds is smaller than viewport', () => {
        transform.resize(1000, 1000);
        const bounds = new LngLatBounds([-5, -5, 5, 5]);
        transform.setMaxBounds(bounds);

        // Try to set zoom to 0, which would show the whole world
        transform.setZoom(0);

        // Expected behavior: map ZOOMS IN to fit the bounds
        // With 10 degrees span and 1000px width, zoom should be around ~6.13
        expect(transform.zoom).toBeGreaterThan(5);
    });

    test('should preserve zoom level if maxBounds covers the viewport', () => {
        transform.setMaxBounds(new LngLatBounds([-50, -50, 50, 50]));
        transform.setZoom(5);
        const originalZoom = transform.zoom;

        const constrained = transform.defaultConstrain(transform.center, transform.zoom);
        
        expect(constrained.zoom).toBeCloseTo(originalZoom, 4);
    });

    test('should fallback to default constraints when no maxBounds are set', () => {
        transform.setMaxBounds(null);
        transform.setCenter(new LngLat(0, 90)); // Valid LngLat but outside MAX_VALID_LATITUDE (approx 85)
        
        expect(transform.center.lat).toBeLessThanOrEqual(85.051129); // MAX_VALID_LATITUDE approx
    });

    test('High Latitude: should require higher zoom to fit bounds at high latitude', () => {
        const transform = new VerticalPerspectiveTransform({minZoom: 0, maxZoom: 22});
        transform.resize(500, 500);

        // Longitude Span: 180 degrees.
        // At Lat 60, circumference is 0.5. So 180 deg is physically half as wide.
        // To fit 512px (approx 500), we need 2x magnification => Zoom 2.
        
        // Latitude Span: 160 degrees (-80 to 80).
        // Vertical fit requires Zoom ~0.1 (very low).
        const bounds = new LngLatBounds([0, -80, 180, 80]); 
        transform.setMaxBounds(bounds);
        
        // Center at Lat 60
        transform.setCenter(new LngLat(90, 60));
        
        // Try to zoom out to 0
        transform.setZoom(0);
        
        expect(transform.zoom).toBeGreaterThan(1.5);
    });
});
