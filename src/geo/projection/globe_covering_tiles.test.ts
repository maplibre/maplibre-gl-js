import {describe, expect, test} from 'vitest';
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
