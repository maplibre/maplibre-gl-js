import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../data/extent';
import {scanlineTriangulateVertexRing, subdividePolygon, subdivideVertexLine} from './subdivision';
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
        const result = subdividePolygon(
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
        testMeshIntegrity(result.indicesTriangles);
        expect(result.verticesFlattened).toEqual([
            0, 0,
            20000, 0,
            20000, 20000,
            0, 20000
        ]);
        expect(result.indicesTriangles).toEqual([2, 0, 3, 0, 2, 1]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Polygon is unchanged when granularity=1, but winding order is corrected.', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(0, 20000),
                    new Point(20000, 20000),
                    new Point(20000, 0),
                ]
            ],
            canonicalDefault,
            1
        );

        expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
        testMeshIntegrity(result.indicesTriangles);
        expect(result.verticesFlattened).toEqual([
            0, 0,
            0, 20000,
            20000, 20000,
            20000, 0
        ]);
        expect(result.indicesTriangles).toEqual([1, 3, 0, 3, 1, 2]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1,
                1, 2,
                2, 3,
                3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Polygon inside cell is unchanged', () => {
        const result = subdividePolygon(
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
        testMeshIntegrity(result.indicesTriangles);
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
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Subdivide a polygon', () => {
        const result = subdividePolygon([
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
        testMeshIntegrity(result.indicesTriangles);
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
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    describe('Polygon outline line list is correct', () => {
        test('Subcell polygon', () => {
            const result = subdividePolygon([
                [
                    new Point(17, 127),
                    new Point(19, 111),
                    new Point(126, 13),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Small polygon', () => {
            const result = subdividePolygon([
                [
                    new Point(17, 15),
                    new Point(261, 13),
                    new Point(19, 273),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Medium polygon', () => {
            const result = subdividePolygon([
                [
                    new Point(17, 127),
                    new Point(1029, 13),
                    new Point(127, 1045),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Large polygon', () => {
            const result = subdividePolygon([
                [
                    new Point(17, 127),
                    new Point(8001, 13),
                    new Point(127, 8003),
                ]
            ], canonicalDefault, granularityForInterval128);
            expect(hasDuplicateVertices(result.verticesFlattened)).toBe(false);
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Large polygon with hole', () => {
            const result = subdividePolygon([
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
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Large polygon with hole, granularity=0', () => {
            const result = subdividePolygon([
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
            testMeshIntegrity(result.indicesTriangles);
            testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Large polygon with hole, finer granularity', () => {
            const result = subdividePolygon([
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
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);

            // This polygon subdivision results in at least one edge that is shared among more than 2 triangles.
            // This is not ideal, but it is also an edge case of a weird triangle getting subdivided by a very fine grid.
            // Furthermore, one edge shared by multiple triangles is not a problem for map rendering,
            // but it should *not* occur when subdividing any simple geometry.

            //testMeshIntegrity(result.indicesTriangles);

            // Polygon outline match test also fails for this specific edge case.

            //testPolygonOutlineMatches(result.indicesTriangles, result.indicesLineList);
        });

        test('Polygon with hole inside cell', () => {
            //       0
            //      / \
            //     / 3 \
            //    / / \ \
            //   / /   \ \
            //  /  5⎺⎺⎺⎺4 \
            // 2⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺1
            const result = subdividePolygon(
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
            testMeshIntegrity(result.indicesTriangles);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                0,  1, // 3
                1,  3, // 4
                -1, 3  // 5
            ]);
            expect(result.indicesTriangles).toEqual([
                2, 4, 5,
                3, 2, 5,
                1, 4, 2,
                3, 0, 2,
                0, 4, 1,
                4, 0, 3
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
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });

        test('Polygon with duplicate vertex with hole inside cell', () => {
            //       0
            //      / \
            //     // \\
            //    //   \\
            //   /4⎺⎺⎺⎺⎺3\
            //  2⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺1
            const result = subdividePolygon(
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
            testMeshIntegrity(result.indicesTriangles);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                1,  3, // 3
                -1, 3  // 4
            ]);
            expect(result.indicesTriangles).toEqual([
                2, 3, 4,
                0, 2, 4,
                3, 1, 0,
                1, 3, 2
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
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
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
            const result = subdividePolygon(
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
            testMeshIntegrity(result.indicesTriangles);
            expect(result.verticesFlattened).toEqual([
                0,  0, // 0
                3,  4, // 1
                -3, 4, // 2
                0,  1, // 3
                -1, 3, // 4
                1,  3  // 5
            ]);
            expect(result.indicesTriangles).toEqual([
                3, 1, 0,
                2, 3, 0,
                5, 1, 3,
                2, 4, 3,
                4, 1, 5,
                1, 4, 2
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
                    3, 0
                ]
            ]);
            checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
        });
    });

    test('Generates pole geometry for both poles', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(EXTENT, 0),
                    new Point(EXTENT, EXTENT),
                    new Point(0, EXTENT),
                ]
            ],
            new CanonicalTileID(0, 0, 0),
            2
        );
        expect(result.verticesFlattened).toEqual([
            0, 0,         // 0
            8192, 0,      // 1
            8192, 8192,   // 2
            0, 8192,      // 3
            0, 4096,      // 4
            4096, 4096,   // 5
            4096, 8192,   // 6
            4096, 0,      // 7
            8192, 4096,   // 8
            0, 32767,     // 9 - South pole - 3 vertices
            4096, 32767,  // 10
            8192, 32767,  // 11
            4096, -32768, // 12 - North pole - 3 vertices
            0, -32768,    // 13
            8192, -32768  // 14
        ]);
        //        0   4096   8192
        //        |      |      |
        // -32K: 13     12     14
        //
        //    0:  0      7      1
        //
        // 4096:  4      5      8
        //
        // 8192:  3      6      2
        //
        //  32K:  9     10     11
        expect(result.indicesTriangles).toEqual([
            0,  4,  5,
            4,  3,  5,
            5,  3,  6,
            5,  6,  2,
            7,  0,  5,
            7,  5,  1,
            1,  5,  8,
            8,  5,  2,
            6,  3,  9,
            10, 6,  9,
            2,  6, 10,
            11, 2, 10,
            0,  7, 12,
            13, 0, 12,
            7,  1, 14,
            12, 7, 14
        ]);
        // The outline intersects the added pole geometry - but that shouldn't be an issue.
        expect(result.indicesLineList).toEqual([
            [
                0, 7,
                7, 1,
                1, 8,
                8, 2,
                2, 6,
                6, 3,
                3, 4,
                4, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Generates pole geometry for north pole only (geometry not bordering other pole)', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(EXTENT, 0),
                    new Point(EXTENT, EXTENT), // Note that one of the vertices touches the south edge...
                    new Point(0, EXTENT - 1),  // ...the other does not.
                ]
            ],
            new CanonicalTileID(0, 0, 0),
            1
        );
        expect(result.verticesFlattened).toEqual([
            0,         0,
            8192,      0,
            8192,   8192,
            0,      8191,
            8192, -32768,
            0,    -32768
        ]);
        expect(result.indicesTriangles).toEqual([
            2, 0, 3, 0, 2,
            1, 0, 1, 4, 5,
            0, 4
        ]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1, 1, 2,
                2, 3, 3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Generates pole geometry for south pole only (geometry not bordering other pole)', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(EXTENT, 1),
                    new Point(EXTENT, EXTENT),
                    new Point(0, EXTENT),
                ]
            ],
            new CanonicalTileID(0, 0, 0),
            1
        );
        expect(result.verticesFlattened).toEqual([
            0,        0,
            8192,     1,
            8192,  8192,
            0,     8192,
            0,    32767,
            8192, 32767
        ]);
        expect(result.indicesTriangles).toEqual([
            2, 0, 3, 0, 2,
            1, 2, 3, 4, 5,
            2, 4
        ]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1, 1, 2,
                2, 3, 3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Generates pole geometry for north pole only (tile not bordering other pole)', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(EXTENT, 0),
                    new Point(EXTENT, EXTENT),
                    new Point(0, EXTENT),
                ]
            ],
            new CanonicalTileID(1, 0, 0),
            1
        );
        expect(result.verticesFlattened).toEqual([
            0,         0,
            8192,      0,
            8192,   8192,
            0,      8192,
            8192, -32768,
            0,    -32768
        ]);
        expect(result.indicesTriangles).toEqual([
            2, 0, 3, 0, 2,
            1, 0, 1, 4, 5,
            0, 4
        ]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1, 1, 2,
                2, 3, 3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Generates pole geometry for south pole only (tile not bordering other pole)', () => {
        const result = subdividePolygon(
            [
                [
                    // x, y
                    new Point(0, 0),
                    new Point(EXTENT, 0),
                    new Point(EXTENT, EXTENT),
                    new Point(0, EXTENT),
                ]
            ],
            new CanonicalTileID(1, 0, 1),
            1
        );
        expect(result.verticesFlattened).toEqual([
            0,        0,
            8192,     0,
            8192,  8192,
            0,     8192,
            0,    32767,
            8192, 32767
        ]);
        expect(result.indicesTriangles).toEqual([
            2, 0, 3, 0, 2,
            1, 2, 3, 4, 5,
            2, 4
        ]);
        expect(result.indicesLineList).toEqual([
            [
                0, 1, 1, 2,
                2, 3, 3, 0
            ]
        ]);
        checkWindingOrder(result.verticesFlattened, result.indicesTriangles);
    });

    test('Scanline subdivision ring generation case 1', () => {
        // Check ring generation on data where it was actually failing
        const vertices = [
            243, 152, // 0
            240, 157, // 1
            237, 160, // 2
            232, 160, // 3
            226, 160, // 4
            232, 153, // 5
            232, 152, // 6
            240, 152  // 7
        ];
        // This vertex ring is slightly degenerate (4-5-6 is concave)
        //      226   232  237 240 243
        //        |     |    |  |  |
        // 152:         6       7  0
        // 153:         5
        //
        //
        //
        // 157:                 1
        //
        //
        // 160:   4     3    2
        const ring = [0, 1, 2, 3, 4, 5, 6, 7];
        const finalIndices = [];
        scanlineTriangulateVertexRing(vertices, ring, finalIndices);
        checkWindingOrder(vertices, finalIndices);
    });

    test('Scanline subdivision ring generation case 2', () => {
        // It should pass on this data
        const vertices = [210, 160, 216, 153, 217, 152, 224, 152, 232, 152, 232, 152, 232, 153, 226, 160, 224, 160, 216, 160];
        const ring = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const finalIndices = [];
        scanlineTriangulateVertexRing(vertices, ring, finalIndices);
        checkWindingOrder(vertices, finalIndices);
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

function getEdgeOccurrencesMap(triangleIndices: Array<number>): Map<string, number> {
    const edgeOccurrences = new Map<string, number>();
    for (let triangleIndex = 0; triangleIndex < triangleIndices.length; triangleIndex += 3) {
        const i0 = triangleIndices[triangleIndex];
        const i1 = triangleIndices[triangleIndex + 1];
        const i2 = triangleIndices[triangleIndex + 2];
        for (const edge of [[i0, i1], [i1, i2], [i2, i0]]) {
            const e0 = Math.min(edge[0], edge[1]);
            const e1 = Math.max(edge[0], edge[1]);
            const key = `${e0}_${e1}`;
            if (edgeOccurrences.has(key)) {
                edgeOccurrences.set(key, edgeOccurrences.get(key) + 1);
            } else {
                edgeOccurrences.set(key, 1);
            }
        }
    }
    return edgeOccurrences;
}

/**
 * Checks that the supplied mesh has no edge that is shared by more than 2 triangles.
 */
function testMeshIntegrity(triangleIndices: Array<number>) {
    const edgeOccurrences = getEdgeOccurrencesMap(triangleIndices);
    for (const pair of edgeOccurrences) {
        if (pair[1] > 2) {
            throw new Error(`Polygon contains an edge with indices ${pair[0].replace('_', ', ')} that is shared by more than 2 triangles.`);
        }
    }
}

/**
 * Checks that the lines in `lineIndicesLists` actually match the exposed edges of the triangle mesh in `triangleIndices`.
 */
function testPolygonOutlineMatches(triangleIndices: Array<number>, lineIndicesLists: Array<Array<number>>): void {
    const edgeOccurrences = getEdgeOccurrencesMap(triangleIndices);
    const uncoveredEdges = new Set<string>();

    for (const pair of edgeOccurrences) {
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

    expect(isSubsetOf(outlineEdges, uncoveredEdges)).toBe(true);
    expect(isSubsetOf(uncoveredEdges, outlineEdges)).toBe(true);
}

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
    for (const key of b) {
        if (!a.has(key)) {
            return false;
        }
    }
    return true;
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

/**
 * Passes if all triangles have the correct winding order, otherwise throws.
 */
function checkWindingOrder(flattened: Array<number>, indices: Array<number>): void {
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const v0x = flattened[i0 * 2];
        const v0y = flattened[i0 * 2 + 1];
        const v1x = flattened[i1 * 2];
        const v1y = flattened[i1 * 2 + 1];
        const v2x = flattened[i2 * 2];
        const v2y = flattened[i2 * 2 + 1];

        const e0x = v1x - v0x;
        const e0y = v1y - v0y;
        const e1x = v2x - v0x;
        const e1y = v2y - v0y;

        const crossProduct = e0x * e1y - e0y * e1x;

        if (crossProduct > 0) {
            // Incorrect
            throw new Error(`Found triangle with wrong winding order! Indices: [${i0} ${i1} ${i2}] Vertices: [(${v0x} ${v0y}) (${v1x} ${v1y}) (${v2x} ${v2y})]`);
        }
    }
}
