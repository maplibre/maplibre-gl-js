import {describe, test, expect} from 'vitest';
import {getIntersectionDistance, Point3D} from './fill_extrusion_style_layer.ts';
import {FillStyleLayer} from './fill_style_layer.ts';

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

describe('FillStyleLayer', () => {
    test('asks for its tiles to be rebuilt when fill-rounded-corner-distance becomes set or unset', () => {
        const layer = new FillStyleLayer({id: 'fill', type: 'fill', source: 'source'}, {});

        expect(layer.setPaintProperty('fill-rounded-corner-distance', 10)).toBe(true);
        expect(layer.setPaintProperty('fill-rounded-corner-distance', null)).toBe(true);
    });

    test('only redraws when fill-rounded-corner-distance changes from one value to another', () => {
        const layer = new FillStyleLayer({id: 'fill', type: 'fill', source: 'source', paint: {'fill-rounded-corner-distance': 10}}, {});

        expect(layer.setPaintProperty('fill-rounded-corner-distance', ['interpolate', ['linear'], ['zoom'], 14, 0, 18, 20])).toBe(false);
    });
});
