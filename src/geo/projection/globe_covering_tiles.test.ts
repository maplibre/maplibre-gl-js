import {Aabb} from '../../util/primitives';
import {expectToBeCloseToArray} from '../../util/test/util';
import {getTileAABB} from './globe_covering_tiles';

describe('aabb', () => {
    test('z=0', () => {
        const aabb = getTileAABB({
            x: 0,
            y: 0,
            z: 0,
        });
        expect(aabb).toEqual(new Aabb(
            [-1, -1, -1],
            [1, 1, 1],
        ));
    });

    test('z=1,x=0', () => {
        const aabb = getTileAABB({
            x: 0,
            y: 0,
            z: 1,
        });
        expect(aabb).toEqual(new Aabb(
            [-1, 0, -1],
            [0, 1, 1],
        ));
    });

    test('z=1,x=1', () => {
        const aabb = getTileAABB({
            x: 1,
            y: 0,
            z: 1,
        });
        expect(aabb).toEqual(new Aabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });

    test('z=2,x=1', () => {
        const aabb = getTileAABB({
            x: 1,
            y: 0,
            z: 2,
        });
        expectToBeCloseToArray([...aabb.min], [-0.3985368153383868, 0.9171523356672743, -7.321002528698027e-17,]);
        expectToBeCloseToArray([...aabb.max], [0, 1, 0.3985368153383868]);
    });
});
