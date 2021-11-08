import {Aabb, Frustum} from './primitives';
import {mat4, vec3, vec4} from 'gl-matrix';

describe('primitives', () => {
    test('Create an aabb', () => {
        const min = vec3.fromValues(0, 0, 0);
        const max = vec3.fromValues(2, 4, 6);
        const aabb = new Aabb(min, max);

        expect(aabb.min).toBe(min);
        expect(aabb.max).toBe(max);
        expect(aabb.center).toEqual([1, 2, 3]);
    });

    test('Create 4 quadrants', () => {
        const min = vec3.fromValues(0, 0, 0);
        const max = vec3.fromValues(2, 4, 1);
        const aabb = new Aabb(min, max);

        expect(aabb.quadrant(0)).toEqual(new Aabb(vec3.fromValues(0, 0, 0), vec3.fromValues(1, 2, 1)));
        expect(aabb.quadrant(1)).toEqual(new Aabb(vec3.fromValues(1, 0, 0), vec3.fromValues(2, 2, 1)));
        expect(aabb.quadrant(2)).toEqual(new Aabb(vec3.fromValues(0, 2, 0), vec3.fromValues(1, 4, 1)));
        expect(aabb.quadrant(3)).toEqual(new Aabb(vec3.fromValues(1, 2, 0), vec3.fromValues(2, 4, 1)));

    });

    test('Distance to a point', () => {
        const min = vec3.fromValues(-1, -1, -1);
        const max = vec3.fromValues(1, 1, 1);
        const aabb = new Aabb(min, max);

        expect(aabb.distanceX([0.5, -0.5])).toBe(0);
        expect(aabb.distanceY([0.5, -0.5])).toBe(0);

        expect(aabb.distanceX([1, 1])).toBe(0);
        expect(aabb.distanceY([1, 1])).toBe(0);

        expect(aabb.distanceX([0, 10])).toBe(0);
        expect(aabb.distanceY([0, 10])).toBe(-9);

        expect(aabb.distanceX([-2, -2])).toBe(1);
        expect(aabb.distanceY([-2, -2])).toBe(1);
    });

    const createTestCameraFrustum = (fovy, aspectRatio, zNear, zFar, elevation, rotation) => {
        const proj = new Float64Array(16) as any as mat4;
        const invProj = new Float64Array(16) as any as mat4;

        // Note that left handed coordinate space is used where z goes towards the sky.
        // Y has to be flipped as well because it's part of the projection/camera matrix used in transform.js
        mat4.perspective(proj, fovy, aspectRatio, zNear, zFar);
        mat4.scale(proj, proj, [1, -1, 1]);
        mat4.translate(proj, proj, [0, 0, elevation]);
        mat4.rotateZ(proj, proj, rotation);
        mat4.invert(invProj, proj);

        return Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
    };

    test('Aabb fully inside a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        // Intersection test is done in xy-plane
        const aabbList = [
            new Aabb(vec3.fromValues(-1, -1, 0), vec3.fromValues(1, 1, 0)),
            new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(5, 5, 0)),
            new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(-4, -2, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersects(frustum)).toBe(2);

    });

    test('Aabb intersecting with a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        const aabbList = [
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(6, 6, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5, -5, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersects(frustum)).toBe(1);

    });

    test('No intersection between aabb and frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        const aabbList = [
            new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersects(frustum)).toBe(0);

    });

});

describe('frustum', () => {
    test('Create a frustum from inverse projection matrix', () => {
        const proj = new Float64Array(16) as any as mat4;
        const invProj = new Float64Array(16) as any as mat4;
        mat4.perspective(proj, Math.PI / 2, 1.0, 0.1, 100.0);
        mat4.invert(invProj, proj);

        const frustum = Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
        // mat4.perspective generates a projection matrix for right handed coordinate space.
        // This means that forward direction will be -z
        const expectedFrustumPoints = [
            [-0.1, 0.1, -0.1, 1.0],
            [0.1, 0.1, -0.1, 1.0],
            [0.1, -0.1, -0.1, 1.0],
            [-0.1, -0.1, -0.1, 1.0],
            [-100.0, 100.0, -100.0, 1.0],
            [100.0, 100.0, -100.0, 1.0],
            [100.0, -100.0, -100.0, 1.0],
            [-100.0, -100.0, -100.0, 1.0],
        ];

        frustum.points = frustum.points.map(array => array.map(n => Math.round(n * 10) / 10)) as vec4[];
        frustum.planes = frustum.planes.map(array => array.map(n => Math.round(n * 1000) / 1000)) as vec4[];

        const expectedFrustumPlanes = [
            [0, 0, 1.0, 0.1],
            [-0, -0, -1.0, -100.0],
            [-0.707, 0, 0.707, -0],
            [0.707, 0, 0.707, -0],
            [0, -0.707, 0.707, -0],
            [-0, 0.707, 0.707, -0]
        ];

        expect(frustum.points).toEqual(expectedFrustumPoints);
        expect(frustum.planes).toEqual(expectedFrustumPlanes);
    });
});
