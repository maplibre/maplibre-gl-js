import {describe, expect, test} from 'vitest';
import {expectToBeCloseToArray} from '../../util/test/util';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider';
import {ConvexBV} from '../../util/primitives/convexbv';

describe('bounding volume creation', () => {
    test('z=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const obb = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 0,
        }, null, null, null);
        expect(obb).toEqual(ConvexBV.fromAabb(
            [-1, -1, -1],
            [1, 1, 1],
        ));
    });

    test('z=1,x=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const obb = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(obb).toEqual(ConvexBV.fromAabb(
            [-1, 0, -1],
            [0, 1, 1],
        ));
    });

    test('z=1,x=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const obb = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(obb).toEqual(ConvexBV.fromAabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });
});
