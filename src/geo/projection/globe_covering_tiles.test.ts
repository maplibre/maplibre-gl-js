import {Aabb} from '../../util/primitives/aabb';
import {expectToBeCloseToArray} from '../../util/test/util';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider';

describe('aabb creation', () => {
    test('z=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 0,
        }, null, null, null);
        expect(aabb).toEqual(new Aabb(
            [-1, -1, -1],
            [1, 1, 1],
        ));
    });

    test('z=1,x=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(aabb).toEqual(new Aabb(
            [-1, 0, -1],
            [0, 1, 1],
        ));
    });

    test('z=1,x=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(aabb).toEqual(new Aabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });

    test('z=2,x=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb = detailsProvider.getTileAABB({
            x: 1,
            y: 0,
            z: 2,
        }, null, null, null);
        expectToBeCloseToArray([...aabb.min], [-0.3985368153383868, 0.9171523356672743, -7.321002528698027e-17,]);
        expectToBeCloseToArray([...aabb.max], [0, 1, 0.3985368153383868]);
    });
});

describe('aabb cache', () => {
    test('retains aabbs from last frame', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const aabb1a = detailsProvider.getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        detailsProvider.newFrame();
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
        detailsProvider.newFrame();
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
        detailsProvider.newFrame();
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
        detailsProvider.newFrame();
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
        detailsProvider.newFrame();
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
