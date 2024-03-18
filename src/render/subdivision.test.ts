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

    test('Simple ring', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(8, 0),
            new Point(0, 8),
        ], granularityForInterval4, true))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(4, 0),
            new Point(8, 0),
            new Point(4, 4),
            new Point(0, 8),
            new Point(0, 4),
            new Point(0, 0),
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
                [
                    // x, y
                    new Point(0, 0),
                    new Point(2, 0),
                    new Point(2, 2),
                    new Point(0, 2),
                ]
            ],
            canonicalDefault,
            granularityForInterval4
        );

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

    test('Subdivide a polygon', () => {
        const result = subdivideFillFromRingList([
            [
                new Point(0, 0),
                new Point(8, 0),
                new Point(0, 8),
            ],
            [
                new Point(1, 1),
                new Point(5, 1),
                new Point(1, 5),
            ]
        ], canonicalDefault, granularityForInterval4);

        expect(result.verticesFlattened).toEqual([
            //    //  indices:
            0, 0, //  0
            8, 0, //  1
            0, 8, //  2
            1, 1, //  3
            5, 1, //  4
            1, 5, //  5
            0, 4, //  6
            4, 0, //  7
            4, 4, //  8
            1, 4, //  9
            4, 1, // 10
            4, 2, // 11
            2, 4, // 12
            4, 3  // 13
        ]);
        //   X: 0   1   2   3   4   5   6   7   8
        // Y:   |   |   |   |   |   |   |   |   |
        //  0:  0               7               1
        //
        //  1:      3          10   4
        //
        //  2:                 11
        //
        //  3:                 13
        //
        //  4:  6   9  12       8
        //
        //  5:      5
        //
        //  6:
        //
        //  7:
        //
        //  8:  2
        expect(result.indicesTriangles).toEqual([
            3,   0,  9,
            10,  0,  3,
            0,   6,  9,
            9,   6,  2,
            9,   2,  5,
            7,   0, 10,
            7,  10,  4,
            7,   4,  1,
            13, 12,  8,
            13,  8,  1,
            5,   2, 12,
            12,  2,  8,
            11, 12, 13,
            11, 13,  4,
            4,  13,  1,
        ]);
        //   X: 0   1   2   3   4   5   6   7   8
        // Y:   |   |   |   |   |   |   |   |   |
        //  0:  0⎼⎼⎽⎽__---------7\--------------1
        //      | ⟍    ⎺⎺⎻⎻⎼⎼⎽⎽ | ⟍     _⎼⎼⎻⎻⎺╱
        //  1:  ||  3----------10---4⎻⎻⎺    ╱╱
        //      ||  |              ╱     ╱ ╱
        //  2:  |⎹  |          11╱╱   ╱  ╱
        //      | ⎹ |        ╱  |╱ ╱   ╱
        //  3:  |  ||      ╱  _13    ╱
        //      |  ⎹|    ╱_⎻⎺⎺  |  ╱
        //  4:  6---9  12-------8╱
        //      |  ⎹| ╱ ⎸      ╱
        //  5:  | ⎹ 5  ⎸     ╱
        //      | ⎸|  ⎸    ╱
        //  6:  |⎹⎹  ⎸   ╱
        //      |⎹⎸ ⎸  ╱
        //  7:  || ⎸ ╱
        //      |⎸⎸╱
        //  8:  2╱
        expect(result.indicesLineList).toEqual([
            [
                2, 6,
                6, 0,
                0, 7,
                7, 1,
                1, 8,
                8, 2
            ],
            [
                5, 9,
                9, 3,
                3, 10,
                10, 4,
                4, 11,
                11, 12,
                12, 5
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

function subdivideFillFromRingList(rings: Array<Array<Point>>, canonical: CanonicalTileID, granularity: number) {
    return subdivideFill(rings, canonical, granularity);
}
