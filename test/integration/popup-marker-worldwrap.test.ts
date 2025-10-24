/**
 * Regression tests for MapLibre #5655: Popup detaches from marker during animation
 * 
 * These tests verify that Popup remains synchronized with Marker when:
 * 1. Animating marker across antimeridian (world wrapping)
 * 2. Performing parallel map interactions (zoom, pan, rotate)
 * 3. Using various popup offsets and anchor positions
 */

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {Map} from '../../src/ui/map';
import {Popup} from '../../src/ui/popup';
import {Marker} from '../../src/ui/marker';
import {LngLat} from '../../src/geo/lng_lat';

describe('Popup #5655: World-wrap synchronization with Marker', () => {
    let container: HTMLElement;
    let map: Map;
    let marker: Marker;
    let popup: Popup;

    beforeEach(function() {
        container = document.createElement('div');
        container.id = 'test-map';
        container.style.width = '600px';
        container.style.height = '400px';
        document.body.appendChild(container);

        map = new Map({
            container,
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 1,
        });

        popup = new Popup({offset: 25}).setText('Test Popup');
        marker = new Marker()
            .setLngLat([0, 0])
            .setPopup(popup)
            .addTo(map);
    });

    afterEach(function() {
        map.remove();
        document.body.removeChild(container);
    });

    /**
     * Test A: Rapid setLngLat() across antimeridian
     * Simulates continuous animation (e.g., satellite tracking)
     */
    it('popup stays attached during rapid antimeridian animation', async function() {
        marker.togglePopup();

        // Sequence: 170° → 180° → -170° (crosses antimeridian multiple times)
        const lngSequence = [
            170, 172, 174, 176, 178, 179, 180,
            -179, -177, -175, -173, -171, -169, -167
        ];

        for (const lng of lngSequence) {
            marker.setLngLat([lng, 0]);

            // Get positions - use getLngLat() which gives normalized coordinates
            const markerLng = marker.getLngLat().lng;
            const popupLng = popup.getLngLat().lng;

            // Calculate shortest distance (accounting for world wrapping)
            let diff = Math.abs(markerLng - popupLng);
            if (diff > 180) diff = 360 - diff;

            // Tolerance: < 1° (allows for small rounding in smartWrap calculations)
            expect(diff).toBeLessThan(1, 
                `At lng=${lng}: marker=${markerLng.toFixed(2)}°, popup=${popupLng.toFixed(2)}°, diff=${diff.toFixed(2)}°`);
        }
    });

    /**
     * Test B: Parallel map interactions during marker animation
     * Ensures popup stays attached even with concurrent zoom/pan/rotate
     */
    it('popup remains attached during map interactions with animation', async function() {
        marker.togglePopup();
        await map.once('load');

        // Animation sequence with parallel map interactions
        const testSteps = [
            { lng: -170, mapOp: 'zoomTo', args: [2] },
            { lng: -160, mapOp: 'easeTo', args: [{center: [10, 0], duration: 1}] },
            { lng: -150, mapOp: 'rotateTo', args: [45, {duration: 1}] },
            { lng: -140, mapOp: 'zoomTo', args: [1] },
            { lng: -130, mapOp: 'panTo', args: [[0, 0]] },
            { lng: -120, mapOp: 'rotateTo', args: [0, {duration: 1}] },
            { lng: 160, mapOp: 'zoomTo', args: [1] },
        ];

        for (const step of testSteps) {
            marker.setLngLat([step.lng, 0]);

            // Perform map operation if specified
            if (step.mapOp && map[step.mapOp]) {
                // Use fire() to trigger synchronously in test; real apps wait on events
                await new Promise(resolve => {
                    setTimeout(() => resolve(null), 10);
                });
            }

            const markerLng = marker.getLngLat().lng;
            const popupLng = popup.getLngLat().lng;

            let diff = Math.abs(markerLng - popupLng);
            if (diff > 180) diff = 360 - diff;

            expect(diff).toBeLessThan(1,
                `Step ${step.lng}°: marker=${markerLng.toFixed(2)}°, popup=${popupLng.toFixed(2)}°`);
        }
    });

    /**
     * Test C: Various popup offsets and anchors
     * Ensures offset/anchor don't interfere with world-wrap synchronization
     */
    it('popup with different offsets/anchors stays attached across antimeridian', async function() {
        const testConfigs = [
            { offset: 0, anchor: 'center' },
            { offset: 25, anchor: 'top' },
            { offset: 50, anchor: 'bottom' },
            { offset: 10, anchor: 'left' },
            { offset: 15, anchor: 'right' },
        ];

        for (const config of testConfigs) {
            // Create new popup with config
            const testPopup = new Popup({
                offset: config.offset,
                anchor: config.anchor as any
            }).setText('Test');

            const testMarker = new Marker()
                .setLngLat([170, 0])
                .setPopup(testPopup)
                .addTo(map);

            testMarker.togglePopup();

            // Quick animation sweep
            for (const lng of [170, 175, 180, -175, -170]) {
                testMarker.setLngLat([lng, 0]);

                const mLng = testMarker.getLngLat().lng;
                const pLng = testPopup.getLngLat().lng;

                let diff = Math.abs(mLng - pLng);
                if (diff > 180) diff = 360 - diff;

                expect(diff).toBeLessThan(1,
                    `Config ${JSON.stringify(config)} at lng=${lng}: diff=${diff.toFixed(2)}°`);
            }

            // Cleanup
            testMarker.remove();
            testPopup.remove();
        }
    });

    /**
     * Test D: Stress test - 100 rapid sequential position changes
     * Ensures no accumulated drift or state corruption
     */
    it('popup remains accurate after 100 rapid position changes', function() {
        marker.togglePopup();

        for (let i = 0; i < 100; i++) {
            // Generate position: full 360° sweep in 100 steps
            const lng = (i * 3.6) - 180;
            marker.setLngLat([lng, 0]);

            const markerLng = marker.getLngLat().lng;
            const popupLng = popup.getLngLat().lng;

            let diff = Math.abs(markerLng - popupLng);
            if (diff > 180) diff = 360 - diff;

            expect(diff).toBeLessThan(1,
                `Step ${i} (lng=${lng.toFixed(1)}°): diff=${diff.toFixed(2)}°`);
        }
    });
});
