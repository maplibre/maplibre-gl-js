import {test} from '../../util/test';
import {default as createFilter, isExpressionFilter} from '../../../rollup/build/tsc/style-spec/feature_filter';

import convertFilter from '../../../rollup/build/tsc/style-spec/feature_filter/convert';
import Point from '../../../rollup/build/tsc/util/point';
import MercatorCoordinate from '../../../rollup/build/tsc/geo/mercator_coordinate';
import EXTENT from '../../../rollup/build/tsc/data/extent';

test('filter', t => {
    t.test('expression, zoom', (t) => {
        const f = createFilter(['>=', ['number', ['get', 'x']], ['zoom']]).filter;
        expect(f({zoom: 1}, {properties: {x: 0}})).toBe(false);
        expect(f({zoom: 1}, {properties: {x: 1.5}})).toBe(true);
        expect(f({zoom: 1}, {properties: {x: 2.5}})).toBe(true);
        expect(f({zoom: 2}, {properties: {x: 0}})).toBe(false);
        expect(f({zoom: 2}, {properties: {x: 1.5}})).toBe(false);
        expect(f({zoom: 2}, {properties: {x: 2.5}})).toBe(true);
        t.end();
    });

    t.test('expression, compare two properties', (t) => {
        t.stub(console, 'warn');
        const f = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']]]).filter;
        expect(f({zoom: 0}, {properties: {x: 1, y: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {x: '1', y: '1'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: 'same', y: 'same'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {x: undefined}})).toBe(false);
        t.end();
    });

    t.test('expression, collator comparison', (t) => {
        const caseSensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': true}]]).filter;
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}})).toBe(false);
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}})).toBe(false);
        expect(caseSensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}})).toBe(true);

        const caseInsensitive = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']], ['collator', {'case-sensitive': false}]]).filter;
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'b'}})).toBe(false);
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'A'}})).toBe(true);
        expect(caseInsensitive({zoom: 0}, {properties: {x: 'a', y: 'a'}})).toBe(true);
        t.end();
    });

    t.test('expression, any/all', (t) => {
        expect(createFilter(['all']).filter()).toBe(true);
        expect(createFilter(['all', true]).filter()).toBe(true);
        expect(createFilter(['all', true, false]).filter()).toBe(false);
        expect(createFilter(['all', true, true]).filter()).toBe(true);
        expect(createFilter(['any']).filter()).toBe(false);
        expect(createFilter(['any', true]).filter()).toBe(true);
        expect(createFilter(['any', true, false]).filter()).toBe(true);
        expect(createFilter(['any', false, false]).filter()).toBe(false);
        t.end();
    });

    t.test('expression, type error', (t) => {
        expect(() => {
            createFilter(['==', ['number', ['get', 'x']], ['string', ['get', 'y']]]);
        }).toThrow();

        expect(() => {
            createFilter(['number', ['get', 'x']]);
        }).toThrow();

        expect(() => {
            createFilter(['boolean', ['get', 'x']]);
        }).not.toThrow();

        t.end();
    });

    t.test('expression, within', (t) => {
        const  getPointFromLngLat = (lng, lat, canonical) => {
            const p = MercatorCoordinate.fromLngLat({lng, lat}, 0);
            const tilesAtZoom = Math.pow(2, canonical.z);
            return new Point(
                (p.x * tilesAtZoom - canonical.x) * EXTENT,
                (p.y * tilesAtZoom - canonical.y) * EXTENT);
        };
        const withinFilter =  createFilter(['within', {'type': 'Polygon', 'coordinates': [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]]}]);
        expect(withinFilter.needGeometry).toBe(true);
        const canonical = {z: 3, x: 3, y:3};
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toBe(true);
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(6, 6, canonical)]]}, canonical)
        ).toBe(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 1, geometry: [[getPointFromLngLat(5, 5, canonical)]]}, canonical)
        ).toBe(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(2, 2, canonical), getPointFromLngLat(3, 3, canonical)]]}, canonical)
        ).toBe(true);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(6, 6, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toBe(false);
        expect(
            withinFilter.filter({zoom: 3}, {type: 2, geometry: [[getPointFromLngLat(5, 5, canonical), getPointFromLngLat(2, 2, canonical)]]}, canonical)
        ).toBe(false);
        t.end();
    });

    legacyFilterTests(t, createFilter);

    t.end();
});

test('legacy filter detection', t => {
    t.test('definitely legacy filters', t => {
        // Expressions with more than two arguments.
        expect(isExpressionFilter(["in", "color", "red", "blue"])).toBeFalsy();

        // Expressions where the second argument is not a string or array.
        expect(isExpressionFilter(["in", "value", 42])).toBeFalsy();
        expect(isExpressionFilter(["in", "value", true])).toBeFalsy();
        t.end();
    });

    t.test('ambiguous value', t => {
        // Should err on the side of reporting as a legacy filter. Style authors can force filters
        // by using a literal expression as the first argument.
        expect(isExpressionFilter(["in", "color", "red"])).toBeFalsy();
        t.end();
    });

    t.test('definitely expressions', t => {
        expect(isExpressionFilter(["in", ["get", "color"], "reddish"])).toBeTruthy();
        expect(isExpressionFilter(["in", ["get", "color"], ["red", "blue"]])).toBeTruthy();
        expect(isExpressionFilter(["in", 42, 42])).toBeTruthy();
        expect(isExpressionFilter(["in", true, true])).toBeTruthy();
        expect(isExpressionFilter(["in", "red", ["get", "colors"]])).toBeTruthy();
        t.end();
    });

    t.end();
});

test('convert legacy filters to expressions', t => {
    t.beforeEach(done => {
        t.stub(console, 'warn');
        done();
    });

    legacyFilterTests(t, (f) => {
        const converted = convertFilter(f);
        return createFilter(converted);
    });

    t.test('mimic legacy type mismatch semantics', (t) => {
        const filter = ["any",
            ["all", [">", "y", 0], [">", "y", 0]],
            [">", "x", 0]
        ];

        const converted = convertFilter(filter);
        const f = createFilter(converted).filter;

        expect(f({zoom: 0}, {properties: {x: 0, y: 1, z: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: 1, y: 0, z: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: 0, y: 0, z: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {x: null, y: 1, z: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: 1, y: null, z: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {x: null, y: null, z: 1}})).toBe(false);
        t.end();
    });

    t.test('flattens nested, single child all expressions', (t) => {
        const filter = [
            "all",
            [
                "in",
                "$type",
                "Polygon",
                "LineString",
                "Point"
            ],
            [
                "all",
                ["in", "type", "island"]
            ]
        ];

        const expected = [
            "all",
            [
                "match",
                ["geometry-type"],
                ["LineString", "Point", "Polygon"],
                true,
                false
            ],
            [
                "match",
                ["get", "type"],
                ["island"],
                true,
                false
            ]
        ];

        const converted = convertFilter(filter);
        expect(converted).toEqual(expected);
        t.end();
    });

    t.test('removes duplicates when outputting match expressions', (t) => {
        const filter = [
            "in",
            "$id",
            1,
            2,
            3,
            2,
            1
        ];

        const expected = [
            "match",
            ["id"],
            [1, 2, 3],
            true,
            false
        ];

        const converted = convertFilter(filter);
        expect(converted).toEqual(expected);
        t.end();
    });

    t.end();
});

function legacyFilterTests(t, createFilterExpr) {
    t.test('degenerate', (t) => {
        expect(createFilterExpr().filter()).toBe(true);
        expect(createFilterExpr(undefined).filter()).toBe(true);
        expect(createFilterExpr(null).filter()).toBe(true);
        t.end();
    });

    t.test('==, string', (t) => {
        const f = createFilterExpr(['==', 'foo', 'bar']).filter;
        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 'baz'}})).toBe(false);
        t.end();
    });

    t.test('==, number', (t) => {
        const f = createFilterExpr(['==', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('==, null', (t) => {
        const f = createFilterExpr(['==', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('==, $type', (t) => {
        const f = createFilterExpr(['==', '$type', 'LineString']).filter;
        expect(f({zoom: 0}, {type: 1})).toBe(false);
        expect(f({zoom: 0}, {type: 2})).toBe(true);
        t.end();
    });

    t.test('==, $id', (t) => {
        const f = createFilterExpr(['==', '$id', 1234]).filter;

        expect(f({zoom: 0}, {id: 1234})).toBe(true);
        expect(f({zoom: 0}, {id: '1234'})).toBe(false);
        expect(f({zoom: 0}, {properties: {id: 1234}})).toBe(false);

        t.end();
    });

    t.test('!=, string', (t) => {
        const f = createFilterExpr(['!=', 'foo', 'bar']).filter;
        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 'baz'}})).toBe(true);
        t.end();
    });

    t.test('!=, number', (t) => {
        const f = createFilterExpr(['!=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(true);
        expect(f({zoom: 0}, {properties: {}})).toBe(true);
        t.end();
    });

    t.test('!=, null', (t) => {
        const f = createFilterExpr(['!=', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        expect(f({zoom: 0}, {properties: {}})).toBe(true);
        t.end();
    });

    t.test('!=, $type', (t) => {
        const f = createFilterExpr(['!=', '$type', 'LineString']).filter;
        expect(f({zoom: 0}, {type: 1})).toBe(true);
        expect(f({zoom: 0}, {type: 2})).toBe(false);
        t.end();
    });

    t.test('<, number', (t) => {
        const f = createFilterExpr(['<', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('<, string', (t) => {
        const f = createFilterExpr(['<', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        t.end();
    });

    t.test('<=, number', (t) => {
        const f = createFilterExpr(['<=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('<=, string', (t) => {
        const f = createFilterExpr(['<=', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        t.end();
    });

    t.test('>, number', (t) => {
        const f = createFilterExpr(['>', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('>, string', (t) => {
        const f = createFilterExpr(['>', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        t.end();
    });

    t.test('>=, number', (t) => {
        const f = createFilterExpr(['>=', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('>=, string', (t) => {
        const f = createFilterExpr(['>=', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: -1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '1'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '-1'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        t.end();
    });

    t.test('in, degenerate', (t) => {
        const f = createFilterExpr(['in', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        t.end();
    });

    t.test('in, string', (t) => {
        const f = createFilterExpr(['in', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('in, number', (t) => {
        const f = createFilterExpr(['in', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        t.end();
    });

    t.test('in, null', (t) => {
        const f = createFilterExpr(['in', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), false);
        t.end();
    });

    t.test('in, multiple', (t) => {
        const f = createFilterExpr(['in', 'foo', 0, 1]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe(false);
        t.end();
    });

    t.test('in, large_multiple', (t) => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.reverse();
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toBe(false);
        t.end();
    });

    t.test('in, large_multiple, heterogeneous', (t) => {
        const values = Array.from({length: 2000}).map(Number.call, Number);
        values.push('a');
        values.unshift('b');
        const f = createFilterExpr(['in', 'foo'].concat(values)).filter;
        expect(f({zoom: 0}, {properties: {foo: 'b'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 'a'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toBe(false);
        t.end();
    });

    t.test('in, $type', (t) => {
        const f = createFilterExpr(['in', '$type', 'LineString', 'Polygon']).filter;
        expect(f({zoom: 0}, {type: 1})).toBe(false);
        expect(f({zoom: 0}, {type: 2})).toBe(true);
        expect(f({zoom: 0}, {type: 3})).toBe(true);

        const f1 = createFilterExpr(['in', '$type', 'Polygon', 'LineString', 'Point']).filter;
        expect(f1({zoom: 0}, {type: 1})).toBe(true);
        expect(f1({zoom: 0}, {type: 2})).toBe(true);
        expect(f1({zoom: 0}, {type: 3})).toBe(true);

        t.end();
    });

    t.test('!in, degenerate', (t) => {
        const f = createFilterExpr(['!in', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        t.end();
    });

    t.test('!in, string', (t) => {
        const f = createFilterExpr(['!in', 'foo', '0']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(true);
        expect(f({zoom: 0}, {properties: {}})).toBe(true);
        t.end();
    });

    t.test('!in, number', (t) => {
        const f = createFilterExpr(['!in', 'foo', 0]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(true);
        t.end();
    });

    t.test('!in, null', (t) => {
        const f = createFilterExpr(['!in', 'foo', null]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        // t.equal(f({zoom: 0}, {properties: {foo: undefined}}), true);
        t.end();
    });

    t.test('!in, multiple', (t) => {
        const f = createFilterExpr(['!in', 'foo', 0, 1]).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe(true);
        t.end();
    });

    t.test('!in, large_multiple', (t) => {
        const f = createFilterExpr(['!in', 'foo'].concat(Array.from({length: 2000}).map(Number.call, Number))).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1999}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 2000}})).toBe(true);
        t.end();
    });

    t.test('!in, $type', (t) => {
        const f = createFilterExpr(['!in', '$type', 'LineString', 'Polygon']).filter;
        expect(f({zoom: 0}, {type: 1})).toBe(true);
        expect(f({zoom: 0}, {type: 2})).toBe(false);
        expect(f({zoom: 0}, {type: 3})).toBe(false);
        t.end();
    });

    t.test('any', (t) => {
        const f1 = createFilterExpr(['any']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        const f2 = createFilterExpr(['any', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        const f3 = createFilterExpr(['any', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        const f4 = createFilterExpr(['any', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        t.end();
    });

    t.test('all', (t) => {
        const f1 = createFilterExpr(['all']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        const f2 = createFilterExpr(['all', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        const f3 = createFilterExpr(['all', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        const f4 = createFilterExpr(['all', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        t.end();
    });

    t.test('none', (t) => {
        const f1 = createFilterExpr(['none']).filter;
        expect(f1({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        const f2 = createFilterExpr(['none', ['==', 'foo', 1]]).filter;
        expect(f2({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        const f3 = createFilterExpr(['none', ['==', 'foo', 0]]).filter;
        expect(f3({zoom: 0}, {properties: {foo: 1}})).toBe(true);

        const f4 = createFilterExpr(['none', ['==', 'foo', 0], ['==', 'foo', 1]]).filter;
        expect(f4({zoom: 0}, {properties: {foo: 1}})).toBe(false);

        t.end();
    });

    t.test('has', (t) => {
        const f = createFilterExpr(['has', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: true}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(true);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(true);
        expect(f({zoom: 0}, {properties: {}})).toBe(false);
        t.end();
    });

    t.test('!has', (t) => {
        const f = createFilterExpr(['!has', 'foo']).filter;
        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: '0'}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: null}})).toBe(false);
        expect(f({zoom: 0}, {properties: {foo: undefined}})).toBe(false);
        expect(f({zoom: 0}, {properties: {}})).toBe(true);
        t.end();
    });
}
