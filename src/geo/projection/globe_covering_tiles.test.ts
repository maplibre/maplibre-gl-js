import {vec4} from 'gl-matrix';
import {Aabb} from '../../util/primitives';
import {expectToBeCloseToArray} from '../../util/test/util';
import {getTileAABB, tileBelowHorizon} from './globe_covering_tiles';

describe('aabb', () => {
    test('z=0', () => {
        const aabb = getTileAABB(0, 0, 0);
        expect(aabb).toEqual(new Aabb(
            [-1, -1, -1],
            [1, 1, 1],
        ));
    });

    test('z=1,x=0', () => {
        const aabb = getTileAABB(0, 0, 1);
        expect(aabb).toEqual(new Aabb(
            [-1, 0, -1],
            [0, 1, 1],
        ));
    });

    test('z=1,x=1', () => {
        const aabb = getTileAABB(1, 0, 1);
        expect(aabb).toEqual(new Aabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });

    test('z=2,x=1', () => {
        const aabb = getTileAABB(1, 0, 2);
        expectToBeCloseToArray([...aabb.min], [-0.3985368153383868, 0.9171523356672743, -7.321002528698027e-17,]);
        expectToBeCloseToArray([...aabb.max], [0, 1, 0.3985368153383868]);
    });
});

describe('tileBelowHorizon', () => {
    test('camera at equator', () => {
        // Camera at equator, horizon plane estimated accordingly.
        const cameraX = 0.5;
        const cameraY = 0.5;
        const plane = [0, 0, 1, -0.8] as vec4;

        // Tile covers entire planet
        expect(tileBelowHorizon(cameraX, cameraY, 0, 0, 0, plane)).toBe(false);

        // Along longitude
        expect(tileBelowHorizon(cameraX, cameraY, 0, 7, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 4, 7, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 5, 7, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 6, 7, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 7, 7, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 8, 7, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 9, 7, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 10, 7, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 11, 7, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 15, 7, 4, plane)).toBe(true);

        // Along latitude
        expect(tileBelowHorizon(cameraX, cameraY, 7, 5, 4, plane)).toBe(true);
        expect(tileBelowHorizon(cameraX, cameraY, 7, 6, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 7, 9, 4, plane)).toBe(false);
        expect(tileBelowHorizon(cameraX, cameraY, 7, 10, 4, plane)).toBe(true);
    });
});
