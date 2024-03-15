import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {subdivideFill, subdivideVertexLine} from './subdivision';
import {CanonicalTileID} from '../source/tile_id';

/**
 * With this granularity, all geometry should be subdivided along axes divisible by 4.
 */
const granularityForInterval4 = EXTENT / 4;

const canonicalDefault = new CanonicalTileID(20, 1, 1);

describe('Line geometry subdivision', () => {
    test('Line inside cell remains unchanged', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 4),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 4),
        ]));

        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 0),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 0),
        ]));

        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 2),
            new Point(4, 2),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 2),
            new Point(4, 2),
        ]));
    });

    test('Simple line', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(1, 1),
            new Point(6, 1),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(1, 1),
            new Point(4, 1),
            new Point(6, 1),
        ]));
    });

    test('Line lies on subdivision axis', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(1, 0),
            new Point(6, 0),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(1, 0),
            new Point(4, 0),
            new Point(6, 0),
        ]));
    });

    test('Line circles a subdivision cell', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 0),
            new Point(4, 4),
            new Point(0, 4),
            new Point(0, 0),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 0),
            new Point(4, 4),
            new Point(0, 4),
            new Point(0, 0),
        ]));
    });

    test('Line goes through cell vertices', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(4, 4),
            new Point(8, 4),
            new Point(8, 8),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 4),
            new Point(8, 4),
            new Point(8, 8),
        ]));
    });

    test('Line crosses several cells', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(12, 5),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 2),
            new Point(8, 3),
            new Point(10, 4),
            new Point(12, 5),
        ]));
    });

    test('Line crosses several cells in negative coordinates', () => {
        // Same geometry as the previous test, just shifted by -1000 in both axes
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-1000, -1000),
            new Point(-1012, -1005),
        ], granularityForInterval4))).toEqual(toSimplePoints([
            new Point(-1000, -1000),
            new Point(-1004, -1002),
            new Point(-1008, -1003),
            new Point(-1010, -1004),
            new Point(-1012, -1005),
        ]));
    });

    test('Line is unmodified at granularity 1', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], 1))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });

    test('Line is unmodified at granularity 0', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], 0))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });

    test('Line is unmodified at granularity -2', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ], -2))).toEqual(toSimplePoints([
            new Point(-EXTENT * 4, 0),
            new Point(EXTENT * 4, 0),
        ]));
    });
});

describe('Fill subdivision', () => {
    test('Polygon inside cell is unchanged', () => {
        const result = subdivideFill(
            [
                // x, y
                0, 0,
                2, 0,
                2, 2,
                0, 2
            ],
            [],
            [
                [
                    // indices, each pair forms a line segment
                    0, 1,
                    1, 2,
                    2, 3,
                    3, 0
                ]
            ],
            canonicalDefault,
            granularityForInterval4
        );
        console.log(result);
        expect(result.verticesFlattened).toEqual([
            0, 0,
            2, 0,
            2, 2,
            0, 2
        ]);
        expect(result.indicesTriangles).toEqual([0, 3, 2, 1, 0, 2]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ]
        ]);
    });
});

/**
 * Converts an array of points into an array of simple \{x, y\} objects.
 * Jest prints much nicer comparisons on arrays of these simple objects than on
 * arrays of points.
 */
function toSimplePoints(a: Array<Point>): Array<{x: number; y: number}> {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result.push({
            x: a[i].x,
            y: a[i].y,
        });
    }
    return result;
}

function ringListToFillParams(rings: Array<Array<Point>>) {
    const flattened = [];
    const holeIndices = [];
    const lines = [];

    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        if (ringIndex > 0) {
            holeIndices.push(flattened.length / 2);
        }
        const baseVertex = flattened.length / 2;
        const ring = rings[ringIndex];
        const outline = [];
        for (let i = 0; i < ring.length; i++) {
            flattened.push(ring[i].x);
            flattened.push(ring[i].y);
            outline.push(baseVertex + (i + ring.length - 1) % ring.length);
            outline.push(baseVertex + i);
        }
        lines.push(outline);
    }

    return {
        flattened,
        holeIndices,
        lines
    };
}

function subdivideFillFromRingList(rings: Array<Array<Point>>, canonical: CanonicalTileID, granularity: number) {
    const params = ringListToFillParams(rings);
    return subdivideFill(params.flattened, params.holeIndices, params.lines, canonical, granularity);
}
