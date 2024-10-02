import {describe, test, expect} from 'vitest';
import {getIntersectionDistance, Point3D} from './fill_extrusion_style_layer';

describe('getIntersectionDistance', () => {
    const queryPoint = [new Point3D(100, 100)];
    const z = 3;
    const a = new Point3D(100, -90);
    const b = new Point3D(110, 110);
    const c = new Point3D(-110, 110);
    a.z = z;
    b.z = z;
    c.z = z;

    test('one point', () => {
        const projectedFace = [a, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('two points', () => {
        const projectedFace = [a, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('two points coincident', () => {
        const projectedFace = [a, a, a, b, b, b, b, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(Infinity);
    });

    test('three points', () => {
        const projectedFace = [a, b, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(z);
    });

    test('three points coincident points', () => {
        const projectedFace = [a, a, b, b, b, c, c, a];
        expect(getIntersectionDistance(queryPoint, projectedFace)).toBe(z);
    });
});
