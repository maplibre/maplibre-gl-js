import {describe, expect, test} from 'vitest';
import {expectToBeCloseToArray} from '../../util/test/util';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider';
import {OrientedBoundingBox} from '../../util/primitives/oriented_bounding_box';

describe('bounding volume creation', () => {
    test('z=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const obb = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 0,
        }, null, null, null);
        expect(obb).toEqual(OrientedBoundingBox.fromAabb(
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
        expect(obb).toEqual(OrientedBoundingBox.fromAabb(
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
        expect(obb).toEqual(OrientedBoundingBox.fromAabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });

    test('z=2,x=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const obb = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 2,
        }, null, null, null);
        expectToBeCloseToArray([...obb.min], [-0.3985368153383868, 0.9171523356672743, -7.321002528698027e-17,]);
        expectToBeCloseToArray([...obb.max], [0, 1, 0.3985368153383868]);
        expectToBeCloseToArray([...obb.center], [-0.14063014521091782, 0.9565511179618896, 0.14063014521091796]);
        expectToBeCloseToArray([...obb.axisX], [-0.003071068827622636, 0.0227058515584064, 0.003071068827622629]);
        expectToBeCloseToArray([...obb.axisY], [0.1992684076691931, 0, 0.19926840766919357]);
        expectToBeCloseToArray([...obb.axisZ], [0.14133567429646782, 0.03823257475689856, -0.14133567429646746]);
    });
});
