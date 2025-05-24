import {describe, expect, test} from 'vitest';
import {GlobeCoveringTilesDetailsProvider} from '../../geo/projection/globe_covering_tiles_details_provider';

describe('bounding volume cache', () => {
    test('retains bounding volumes from last frame', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const box1a = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        detailsProvider.prepareNextFrame();
        const box1b = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(box1a).toBe(box1b); // Test reference equality
    });

    test('clears no longer used bounding volumes', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        // Get 1+2+3
        const box1a = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box2a = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3a = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.prepareNextFrame();
        // Get 2+3+4
        const box2b = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3b = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        const box4b = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.prepareNextFrame();
        // Get 1+3+4
        const box1c = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3c = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        const box4c = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 1,
            z: 1,
        }, null, null, null);
        // All returned objects should have equal internal values
        expect(box1a).toEqual(box1c);
        expect(box2a).toEqual(box2b);
        expect(box3a).toEqual(box3b);
        expect(box3a).toEqual(box3c);
        expect(box4b).toEqual(box4c);
        // Test that cache behaves as expected
        expect(box1a).not.toBe(box1c);
        expect(box2a).toBe(box2b);
        expect(box3a).toBe(box3b);
        expect(box3a).toBe(box3c);
        expect(box4b).toBe(box4c);
    });

    test('does not clear cache if no new box was added', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        // Get 1+2+3
        const box1a = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box2a = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3a = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.prepareNextFrame();
        // Get 2+3
        const box2b = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3b = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.prepareNextFrame();
        // Get 1+3
        const box1c = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3c = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        // All returned objects should have equal internal values
        expect(box1a).toEqual(box1c);
        expect(box2a).toEqual(box2b);
        expect(box3a).toEqual(box3b);
        expect(box3a).toEqual(box3c);
        // Test that cache behaves as expected
        expect(box1a).toBe(box1c);
        expect(box2a).toBe(box2b);
        expect(box3a).toBe(box3b);
        expect(box3a).toBe(box3c);
    });
});
