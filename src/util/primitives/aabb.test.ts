import {describe, test, expect} from 'vitest';
import {vec3, type vec4} from 'gl-matrix';
import {Aabb} from './aabb';
import {IntersectionResult} from './bounding_volume';
import {createTestCameraFrustum} from '../test/util';

describe('aabb', () => {
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

    test('Aabb fully inside a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        // Intersection test is done in xy-plane
        const aabbList = [
            new Aabb(vec3.fromValues(-1, -1, 0), vec3.fromValues(1, 1, 0)),
            new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(5, 5, 0)),
            new Aabb(vec3.fromValues(-5, -5, 0), vec3.fromValues(-4, -2, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsFrustum(frustum)).toBe(IntersectionResult.Full);

    });

    test('Aabb intersecting with a frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        const aabbList = [
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(6, 6, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5, -5, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsFrustum(frustum)).toBe(IntersectionResult.Partial);

    });

    test('No intersection between aabb and frustum', () => {
        const frustum = createTestCameraFrustum(Math.PI / 2, 1.0, 0.1, 100.0, -5, 0);

        const aabbList = [
            new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 0))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsFrustum(frustum)).toBe(IntersectionResult.None);

    });

    test('Aabb fully inside a half-space', () => {
        const plane: vec4 = [1, 0, 0, 6];

        const aabbList = [
            new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 4))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsPlane(plane)).toBe(IntersectionResult.Full);

    });

    test('Aabb intersecting a half-space', () => {
        const plane: vec4 = [1, 0, -10, 5.75];

        const aabbList = [
            new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 4))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsPlane(plane)).toBe(IntersectionResult.Partial);

    });

    test('No intersection between aabb and half-space', () => {
        const plane: vec4 = [1, 0, 0, -8];

        const aabbList = [
            new Aabb(vec3.fromValues(-6, 0, 0), vec3.fromValues(-5.5, 0, 0)),
            new Aabb(vec3.fromValues(-6, -6, 0), vec3.fromValues(-5.5, -5.5, 0)),
            new Aabb(vec3.fromValues(7, -10, 0), vec3.fromValues(7.1, 20, 4))
        ];

        for (const aabb of aabbList)
            expect(aabb.intersectsPlane(plane)).toBe(IntersectionResult.None);

    });

    test('Aabb and halfspace intersection edge cases', () => {
        // Plane at box edge, box inside halfspace
        expect(new Aabb([0, 0, 0], [1, 1, 1]).intersectsPlane([1, 0, 0, 0])).toBe(IntersectionResult.Full);
        // Plane at box edge, box outside halfspace
        expect(new Aabb([0, 0, 0], [1, 1, 1]).intersectsPlane([-1, 0, 0, 0])).toBe(IntersectionResult.Partial);
        // Plane intersects a single vertex, box outside halfspace
        expect(new Aabb([0, 0, 0], [1, 1, 1]).intersectsPlane([-1, -1, -1, 0])).toBe(IntersectionResult.Partial);
        // Box inside halfspace
        expect(new Aabb([0, 0, 0], [1, 1, 1]).intersectsPlane([1, 1, 1, 0])).toBe(IntersectionResult.Full);
        // Box barely outside halfspace
        expect(new Aabb([0, 0, 0], [1, 1, 1]).intersectsPlane([-1, -1, -1, -0.00000001])).toBe(IntersectionResult.None);
        // Same plane as last time, but different box, with a single vertex barely outside the halfspace
        expect(new Aabb([-1, -1, -1], [0, 0, 0]).intersectsPlane([-1, -1, -1, -0.00000001])).toBe(IntersectionResult.Partial);
    });
});
