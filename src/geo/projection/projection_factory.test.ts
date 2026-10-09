import {afterEach, beforeEach, describe, test, expect} from 'vitest';
import {createProjectionFromName} from './projection_factory.ts';
import {addProjection, removeProjection} from './projection_crud.ts';
import {MercatorProjection} from './mercator_projection.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {MercatorCameraHelper} from './mercator_camera_helper.ts';

afterEach(() => {
    removeProjection('factory-test-crs');
});

describe('createProjectionFromName', () => {
    test('resolves the built-in identity projection to a mercator projection named identity', () => {
        const {projection} = createProjectionFromName('identity', undefined, {});
        expect(projection).toBeInstanceOf(MercatorProjection);
        expect(projection.name).toBe('identity');
    });

    test('runs the identity projection on the mercator transform and camera helper over a non-wrapping world', () => {
        const {transform, cameraHelper} = createProjectionFromName('identity', undefined, {});
        expect(transform).toBeInstanceOf(MercatorTransform);
        expect(transform.worldCoordinateHelper.wraps).toBe(false);
        expect(cameraHelper).toBeInstanceOf(MercatorCameraHelper);
    });

    describe('for a registered CRS', () => {
        beforeEach(() => {
            addProjection({
                name: 'factory-test-crs',
                projection: {forward: ([lng, lat]) => [lng * 2, lat * 2], inverse: ([x, y]) => [x / 2, y / 2]},
                tileMatrixSet: {origin: [-180, 180], extentAtZoom0: 360},
            });
        });

        test('resolves its name to a mercator projection under that name over its definition', () => {
            const {projection} = createProjectionFromName('factory-test-crs', undefined, {});
            expect(projection).toBeInstanceOf(MercatorProjection);
            expect(projection.name).toBe('factory-test-crs');
            const world = projection.worldCoordinateHelper.worldFromLngLat(90, 90);
            expect([world.x, world.y]).toEqual([1, 0]);
        });

        test('runs its transform on the projection\'s own mapping', () => {
            const {projection, transform} = createProjectionFromName('factory-test-crs', undefined, {});
            expect(transform.worldCoordinateHelper).toBe(projection.worldCoordinateHelper);
        });
    });
});
