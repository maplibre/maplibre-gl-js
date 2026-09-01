import {afterEach, describe, test, expect} from 'vitest';
import {createProjectionFromName} from './projection_factory.ts';
import {addProjection, removeProjection} from './projection_crud.ts';
import {PlanarProjection} from './planar_projection.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {MercatorCameraHelper} from './mercator_camera_helper.ts';

afterEach(() => {
    removeProjection('factory-test-crs');
});

describe('createProjectionFromName', () => {
    test('resolves the built-in simple projection to a planar projection over a non-wrapping transform', () => {
        const {projection, transform, cameraHelper} = createProjectionFromName('simple', undefined, {});
        expect(projection).toBeInstanceOf(PlanarProjection);
        expect(projection.name).toBe('simple');
        expect(projection.isPlanar).toBe(true);
        expect(transform).toBeInstanceOf(MercatorTransform);
        expect(transform.worldCoordinateHelper.wraps).toBe(false);
        expect(cameraHelper).toBeInstanceOf(MercatorCameraHelper);
    });

    test('resolves a registered name to a planar projection over its definition', () => {
        addProjection({
            name: 'factory-test-crs',
            project: (lng, lat) => [lng * 2, lat * 2],
            unproject: (x, y) => [x / 2, y / 2],
            tileMatrix: {origin: [-180, 180], extentAtZoom0: 360},
        });
        const {projection, transform} = createProjectionFromName('factory-test-crs', undefined, {});
        expect(projection).toBeInstanceOf(PlanarProjection);
        expect(projection.name).toBe('factory-test-crs');
        const world = transform.worldCoordinateHelper.worldFromLngLat(90, 90);
        expect([world.x, world.y]).toEqual([1, 0]);
    });
});
