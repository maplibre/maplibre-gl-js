import {describe, test, expect} from 'vitest';
import {mat4, vec3} from 'gl-matrix';
import {Frustum} from './frustum';
import {IntersectionResult} from './bounding_volume';
import {createTestCameraFrustum, expectToBeCloseToArray} from '../test/util';
import {ConvexVolume} from './convex_volume';

describe('convex bounding volume', () => {
    describe('fromCenterSizeAngles', () => {
        test('translated unit box', () => {
            const obb = ConvexVolume.fromCenterSizeAngles([0, 1, 0], [1, 1, 1], [0, 0, 0]);
            expect(obb.min).toEqual([-1, 0, -1]);
            expect(obb.max).toEqual([1, 2, 1]);
        });

        test('nonuniform box', () => {
            const obb = ConvexVolume.fromCenterSizeAngles([0, 0, 0], [1, 2, 3], [0, 0, 0]);
            expect(obb.min).toEqual([-1, -2, -3]);
            expect(obb.max).toEqual([1, 2, 3]);
        });

        test('translated rotated 90° unit box', () => {
            const obb = ConvexVolume.fromCenterSizeAngles([0, 2, 0], [1, 1, 1], [90, 0, 0]);
            expectToBeCloseToArray([...obb.min], [-1, 1, -1]);
            expectToBeCloseToArray([...obb.max], [1, 3, 1]);
        });
    });

    test('box fully inside a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);
        // Use same boxes as the AABB tests - this will still test the convex volume intersection logic.
        const boxList = [
            ConvexVolume.fromAabb(vec3.fromValues(-1, -1, 0), vec3.fromValues(1, 1, 0)),
            ConvexVolume.fromAabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(5, 5, 0)),
            ConvexVolume.fromAabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(-4, -2, 0))
        ];

        for (const box of boxList)
            expect(box.intersectsFrustum(frustum)).toBe(IntersectionResult.Full);

    });

    test('box intersecting with a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);
        expect(ConvexVolume.fromAabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(6, 6, 0)).intersectsFrustum(frustum)).toBe(IntersectionResult.Partial);
        expect(ConvexVolume.fromAabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5, -5, 0)).intersectsFrustum(frustum)).toBe(IntersectionResult.Partial);
    });

    test('No intersection between box and frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        const boxList = [
            ConvexVolume.fromAabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            ConvexVolume.fromAabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            ConvexVolume.fromAabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 0))
        ];

        for (const box of boxList)
            expect(box.intersectsFrustum(frustum)).toBe(IntersectionResult.None);

    });

    test('Obb-plane intersection axis-aligned', () => {
        const obb = ConvexVolume.fromCenterSizeAngles([0, 0, 0], [1, 1, 1], [0, 0, 0]);
        expect(obb.intersectsPlane([1, 0, 0, 1.0001])).toBe(IntersectionResult.Full);
        expect(obb.intersectsPlane([1, 0, 0, 0.9999])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 0, 0, 0])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 0, 0, -0.9999])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 0, 0, -1.0001])).toBe(IntersectionResult.None);
    });

    test('Obb-plane intersection rotated plane', () => {
        const obb = ConvexVolume.fromCenterSizeAngles([0, 0, 0], [1, 1, 1], [0, 0, 0]);
        expect(obb.intersectsPlane([1, 1, 0, 2.0001])).toBe(IntersectionResult.Full);
        expect(obb.intersectsPlane([1, 1, 0, 1.9999])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 1, 0, 0])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 1, 0, -1.9999])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 1, 0, -2.0001])).toBe(IntersectionResult.None);
    });

    test('Obb-plane intersection rotated box', () => {
        const obb = ConvexVolume.fromCenterSizeAngles([0, 0, 0], [1, 1, 1], [0, 0, 45]);
        expect(obb.intersectsPlane([1, 0, 0, 1.4143])).toBe(IntersectionResult.Full);
        expect(obb.intersectsPlane([1, 0, 0, 1.4142])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 0, 0, -1.4142])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 0, 0, -1.4143])).toBe(IntersectionResult.None);
    });

    test('Obb-plane intersection rotated plane rotated box', () => {
        const obb = ConvexVolume.fromCenterSizeAngles([0, 0, 0], [1, 1, 1], [0, 0, 45]);
        expect(obb.intersectsPlane([1, 1, 0, 1.4143])).toBe(IntersectionResult.Full);
        expect(obb.intersectsPlane([1, 1, 0, 1.4142])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 1, 0, -1.4142])).toBe(IntersectionResult.Partial);
        expect(obb.intersectsPlane([1, 1, 0, -1.4143])).toBe(IntersectionResult.None);
    });

    test('Frustum - large box test', () => {
        const proj = new Float64Array(16) as any as mat4;
        const invProj = new Float64Array(16) as any as mat4;
        mat4.perspective(proj, Math.PI / 2, 1.0, 0.1, 100.0);
        mat4.invert(invProj, proj);

        const frustum = Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);

        expect(ConvexVolume.fromAabb([-400, 50, -40], [400, 500, 400]).intersectsFrustum(frustum)).toBe(IntersectionResult.None);
        expect(ConvexVolume.fromAabb([-400, 101, -400], [400, 500, 400]).intersectsFrustum(frustum)).toBe(IntersectionResult.None);
        // Rotated box that lies entirely outside the frustum but intersects its far plane and some side planes as well.
        expect(ConvexVolume.fromCenterSizeAngles([0, 200, -200], [1000, 141, 1000], [45, 0, 0]).intersectsFrustum(frustum)).toBe(IntersectionResult.None);
    });
});
