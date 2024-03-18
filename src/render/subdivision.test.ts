import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {getDebugSvg, subdivideFill, subdivideVertexLine} from './subdivision';
import {CanonicalTileID} from '../source/tile_id';

/**
 * With this granularity, all geometry should be subdivided along axes divisible by 4.
 */
const granularityForInterval4 = EXTENT / 4;
const granularityForInterval128 = EXTENT / 128;

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

    test('Simple ring inside cell', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(8, 0),
            new Point(0, 8),
        ], granularityForInterval128, true))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(8, 0),
            new Point(0, 8),
            new Point(0, 0),
        ]));
    });

    test('Simple ring is unchanged when granularity=0', () => {
        expect(toSimplePoints(subdivideVertexLine([
            new Point(0, 0),
            new Point(8, 0),
            new Point(0, 8),
        ], 0, true))).toEqual(toSimplePoints([
            new Point(0, 0),
            new Point(8, 0),
            new Point(0, 8),
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
    test('Polygon is unchanged when granularity=1', () => {
        const result = subdivideFill(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(20000, 0),
                    new Point(20000, 20000),
                    new Point(0, 20000),
                ]
            ],
            canonicalDefault,
            1
        );

        expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
        expect(result.verticesFlattened).toEqual([
            0, 0,
            20000, 0,
            20000, 20000,
            0, 20000
        ]);
        expect(result.indicesTriangles).toEqual([2, 3, 0, 0, 1, 2]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ]
        ]);
    });

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

        expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
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

        expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
        expect(result.verticesFlattened).toEqual([
            //    // indices:
            0, 0, //  0
            8, 0, //  1
            0, 8, //  2
            1, 1, //  3
            5, 1, //  4
            1, 5, //  5
            1, 4, //  6
            4, 1, //  7
            0, 4, //  8
            4, 0, //  9
            4, 4, // 10
            2, 4, // 11
            4, 3, // 12
            4, 2  // 13
        ]);
        //   X: 0   1   2   3   4   5   6   7   8
        // Y:   |   |   |   |   |   |   |   |   |
        //  0:  0               9               1
        //
        //  1:      3           7   4
        //
        //  2:                 13
        //
        //  3:                 12
        //
        //  4:  8   6  11      10
        //
        //  5:      5
        //
        //  6:
        //
        //  7:
        //
        //  8:  2
        expect(result.indicesTriangles).toEqual([
            3,   0,  6,
            7,   0,  3,
            0,   8,  6,
            6,   8,  2,
            6,   2,  5,
            9,   0,  7,
            9,   7,  4,
            9,   4,  1,
            12, 11, 10,
            12, 10,  1,
            5,   2, 11,
            11,  2, 10,
            13, 11, 12,
            13, 12,  4,
            4,  12,  1
        ]);
        //   X: 0   1   2   3   4   5   6   7   8
        // Y:   |   |   |   |   |   |   |   |   |
        //  0:  0⎼⎼⎽⎽__---------9\--------------1
        //      | ⟍    ⎺⎺⎻⎻⎼⎼⎽⎽ | ⟍     _⎼⎼⎻⎻⎺╱
        //  1:  ||  3-----------7---4⎻⎻⎺    ╱╱
        //      ||  |              ╱     ╱ ╱
        //  2:  |⎹  |          13╱╱   ╱  ╱
        //      | ⎹ |        ╱  |╱ ╱   ╱
        //  3:  |  ||      ╱  _12    ╱
        //      |  ⎹|    ╱_⎻⎺⎺  |  ╱
        //  4:  8---6  11------10╱
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
                0,  9,
                9,  1,
                1, 10,
                10, 2,
                2,  8,
                8,  0
            ],
            [
                3,   7,
                7,   4,
                4,  13,
                13, 11,
                11,  5,
                5,   6,
                6,   3
            ]
        ]);
    });

    describe('Polygon outline line list is correct', () => {
        test('Subcell polygon', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 127),
                    new Point(19, 111),
                    new Point(126, 13),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Small polygon', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 15),
                    new Point(261, 13),
                    new Point(19, 273),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Medium polygon', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 127),
                    new Point(1029, 13),
                    new Point(127, 1045),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Large polygon', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 127),
                    new Point(8001, 13),
                    new Point(127, 8003),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Large polygon with hole', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 127),
                    new Point(8001, 13),
                    new Point(127, 8003),
                ],
                [
                    new Point(1001, 1002),
                    new Point(1502, 1008),
                    new Point(1004, 1523),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Large polygon with hole, granularity=0', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 127),
                    new Point(8001, 13),
                    new Point(127, 8003),
                ],
                [
                    new Point(1001, 1002),
                    new Point(1502, 1008),
                    new Point(1004, 1523),
                ]
            ], canonicalDefault, 0);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Large polygon with hole, finer granularity', () => {
            const result = subdivideFillFromRingList([
                [
                    new Point(17, 1),
                    new Point(347, 13),
                    new Point(19, 453),
                ],
                [
                    new Point(23, 7),
                    new Point(319, 17),
                    new Point(29, 399),
                ]
            ], canonicalDefault, EXTENT / 8);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Polygon with hole inside cell', () => {
            //       0
            //      / \
            //     / 3 \
            //    / / \ \
            //   / /   \ \
            //  /  5⎺⎺⎺⎺4 \
            // 2⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺1
            const result = subdivideFill(
                [
                    [
                        new Point(0, 0),
                        new Point(3, 4),
                        new Point(-3, 4),
                    ],
                    [
                        new Point(0, 1),
                        new Point(1, 3),
                        new Point(-1, 3),
                    ]
                ],
                canonicalDefault,
                0
            );

            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                0,  1, // 3
                1,  3, // 4
                -1, 3  // 5
            ]);
            expect(result.indicesTriangles).toEqual([
                2, 5, 4,
                3, 5, 2,
                1, 2, 4,
                3, 2, 0,
                0, 1, 4,
                4, 3, 0
            ]);
            expect(result.indicesLineList).toEqual([
                [
                    0, 1,
                    1, 2,
                    2, 0
                ],
                [
                    3, 4,
                    4, 5,
                    5, 3
                ]
            ]);
        });

        test('Polygon with duplicate vertex with hole inside cell', () => {
            //       0
            //      / \
            //     // \\
            //    //   \\
            //   /4⎺⎺⎺⎺⎺3\
            //  2⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺1
            const result = subdivideFill(
                [
                    [
                        new Point(0, 0),
                        new Point(3, 4),
                        new Point(-3, 4),
                    ],
                    [
                        new Point(0, 0),
                        new Point(1, 3),
                        new Point(-1, 3),
                    ]
                ],
                canonicalDefault,
                0
            );

            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                1,  3, // 3
                -1, 3  // 4
            ]);
            expect(result.indicesTriangles).toEqual([
                2, 4, 3,
                0, 4, 2,
                3, 0, 1,
                1, 2, 3
            ]);
            expect(result.indicesLineList).toEqual([
                [
                    0, 1,
                    1, 2,
                    2, 0
                ],
                [
                    0, 3,
                    3, 4,
                    4, 0
                ]
            ]);
        });

        test('Polygon with duplicate edge inside cell', () => {
            // Test a slightly degenerate polygon, where the hole is achieved using a duplicate edge
            //       0
            //      /|\
            //     / 3 \
            //    / / \ \
            //   / /   \ \
            //  / 4⎺⎺⎺⎺⎺5 \
            // 2⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺1
            const result = subdivideFill(
                [
                    [
                        new Point(0, 0),
                        new Point(3, 4),
                        new Point(-3, 4),
                        new Point(0, 0),
                        new Point(0, 1),
                        new Point(-1, 3),
                        new Point(1, 3),
                        new Point(0, 1),
                        new Point(0, 0),
                    ]
                ],
                canonicalDefault,
                0
            );

            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                0,  1, // 3
                -1, 3, // 4
                1,  3  // 5
            ]);
            expect(result.indicesTriangles).toEqual([
                3, 0, 1,
                2, 0, 3,
                5, 3, 1,
                2, 3, 4,
                4, 5, 1,
                1, 2, 4
            ]);
            expect(result.indicesLineList).toEqual([
                [
                    0, 1,
                    1, 2,
                    2, 0,
                    0, 3,
                    3, 4,
                    4, 5,
                    5, 3,
                    3, 0,
                    0, 0
                ]
            ]);
        });
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

function testPolygonOutlineMatches(triangleIndices: Array<number>, lineIndicesLists: Array<Array<number>>): void {
    const edgeOccurences = new Map<string, number>();
    for (let triangleIndex = 0; triangleIndex < triangleIndices.length; triangleIndex += 3) {
        const i0 = triangleIndices[triangleIndex];
        const i1 = triangleIndices[triangleIndex + 1];
        const i2 = triangleIndices[triangleIndex + 2];
        for (const edge of [[i0, i1], [i1, i2], [i2, i0]]) {
            const e0 = Math.min(edge[0], edge[1]);
            const e1 = Math.max(edge[0], edge[1]);
            const key = `${e0}_${e1}`;
            if (edgeOccurences.has(key)) {
                edgeOccurences.set(key, edgeOccurences.get(key) + 1);
            } else {
                edgeOccurences.set(key, 1);
            }
        }
    }

    const uncoveredEdges = new Set<string>();

    for (const pair of edgeOccurences) {
        if (pair[1] > 2) {
            throw new Error(`Polygon contains an edge with indices ${pair[0].replace('_', ', ')} that is shared by more than 2 triangles.`);
        }
        if (pair[1] === 1) {
            uncoveredEdges.add(pair[0]);
        }
    }

    const outlineEdges = new Set<string>();

    for (const lines of lineIndicesLists) {
        for (let i = 0; i < lines.length; i += 2) {
            const i0 = lines[i];
            const i1 = lines[i + 1];
            const e0 = Math.min(i0, i1);
            const e1 = Math.max(i0, i1);
            const key = `${e0}_${e1}`;
            if (outlineEdges.has(key)) {
                throw new Error(`Outline line lists contain edge with indices ${e0}, ${e1} multiple times.`);
            }
            outlineEdges.add(key);
        }
    }

    if (uncoveredEdges.size !== outlineEdges.size) {
        throw new Error(`Polygon exposed triangle edge count ${uncoveredEdges.size} and outline line count ${outlineEdges.size} does not match.`);
    }

    const isSubsetOf = (a: Set<string>, b: Set<string>): boolean => {
        for (const key of b) {
            if (!a.has(key)) {
                return false;
            }
        }
        return true;
    };

    expect(isSubsetOf(outlineEdges, uncoveredEdges)).toBe(true);
    expect(isSubsetOf(uncoveredEdges, outlineEdges)).toBe(true);
}

function hasDuplicateVertices(flattened: Array<number>): boolean {
    const set = new Set<string>();
    for (let i = 0; i < flattened.length; i += 2) {
        const vx = flattened[i];
        const vy = flattened[i + 1];
        const key = `${vx}_${vy}`;
        if (set.has(key)) {
            return true;
        }
        set.add(key);
    }
    return false;
}
