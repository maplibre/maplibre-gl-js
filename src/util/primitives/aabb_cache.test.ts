import {describe, expect, test} from 'vitest';
import {GlobeCoveringTilesDetailsProvider} from '../../geo/projection/globe_covering_tiles_details_provider';

describe('aabb cache', () => {
    test('retains aabbs from last frame', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb1a = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        detailsProvider.recalculateCache();
        const aabb1b = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(aabb1a).toBe(aabb1b); // Test reference equality
    });

    test('clears no longer used aabbs', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        // Get 1+2+3
        const box1a = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box2a = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3a = detailsProvider.getTileAABB({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.recalculateCache();
        // Get 2+3+4
        const box2b = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3b = detailsProvider.getTileAABB({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        const box4b = detailsProvider.getTileAABB({
            x: 1,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.recalculateCache();
        // Get 1+3+4
        const box1c = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3c = detailsProvider.getTileAABB({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        const box4c = detailsProvider.getTileAABB({
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
        const box1a = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box2a = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3a = detailsProvider.getTileAABB({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.recalculateCache();
        // Get 2+3
        const box2b = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3b = detailsProvider.getTileAABB({
            x: 0,
            y: 1,
            z: 1,
        }, null, null, null);
        detailsProvider.recalculateCache();
        // Get 1+3
        const box1c = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        const box3c = detailsProvider.getTileAABB({
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
