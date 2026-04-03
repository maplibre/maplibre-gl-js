import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {findPoleOfInaccessibility, getCentroidCell} from './find_pole_of_inaccessibility';

describe('findPoleOfInaccessibility', () => {
    test('should find the pole of inaccessibility for a simple polygon', () => {
        const closedRing = [
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(0, 10),
            new Point(0, 0)
        ];
        const result = findPoleOfInaccessibility([closedRing], 0.1);
        expect(result).toEqual(new Point(5, 5));
        const centroid = getCentroidCell([closedRing]).p;
        expect(result).toEqual(centroid);
    });

    test('should find the pole of inaccessibility for a polygon with a hole', () => {
        const closedRing = [
            new Point(0, 0),
            new Point(10, 10),
            new Point(10, 0),
            new Point(0, 0)
        ];
        const closedRingHole = [
            new Point(2, 1),
            new Point(6, 6),
            new Point(6, 1),
            new Point(2, 1)
        ];
        const result = findPoleOfInaccessibility([closedRing, closedRingHole], 0.1);
        expect(result).toEqual(new Point(7.96875, 2.03125));
        const centroid = getCentroidCell([closedRing, closedRingHole]).p;
        expect(result).not.toEqual(centroid);
    });

    test('should prefer centroid for a convex polygon when within precision', () => {
        const closedRing = [
            new Point(0, 0),
            new Point(10, 10),
            new Point(10, 0),
            new Point(0, 0)
        ];
        const result = findPoleOfInaccessibility([closedRing], 1);
        expect(result).toEqual(new Point(40/6, 20/6));
        const centroid = getCentroidCell([closedRing]).p;
        expect(result).toEqual(centroid);
    });

    test('should not prefer centroid for a concave polygon where POI is significantly better', () => {
        // U-shaped polygon => centroid is in the hollow area
        const uShape = [
            new Point(0, 0),
            new Point(10, 0),
            new Point(10, 10),
            new Point(8, 10),
            new Point(8, 2),
            new Point(2, 2),
            new Point(2, 10),
            new Point(0, 10),
            new Point(0, 0)
        ];
        const result = findPoleOfInaccessibility([uShape], 0.1);
        expect(result).toEqual(new Point(8.828125, 1.171875));
        const centroid = getCentroidCell([uShape]).p;
        expect(result).not.toEqual(centroid);
    });
});
