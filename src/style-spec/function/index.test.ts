import {createFunction} from './index';
import Color from '../util/color';
import Formatted from '../expression/types/formatted';
import Padding from '../util/padding';

describe('binary search', () => {
    test('will eventually terminate.', () => {
        const f = createFunction({
            stops: [[9, 10], [17, 11], [17, 11], [18, 13]],
            base: 2
        }, {
            type: 'number',
            'property-type': 'data-constant',
            expression: {
                'interpolated': true,
                'parameters': ['zoom']
            }
        }).evaluate;

        expect(f({zoom: 17}, undefined)).toBe(11);

    });
});

describe('exponential function', () => {
    test('is the default for interpolated properties', () => {
        const f = createFunction({
            stops: [[1, 2], [3, 6]],
            base: 2
        }, {
            type: 'number',
            'property-type': 'data-constant',
            expression: {
                'interpolated': true,
                'parameters': ['zoom']
            }
        }).evaluate;

        expect(f({zoom: 2}, undefined)).toBeCloseTo(30 / 9);

    });

    test('base', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]],
            base: 2
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toBeCloseTo(2);
        expect(f({zoom: 1}, undefined)).toBeCloseTo(2);
        expect(f({zoom: 2}, undefined)).toBeCloseTo(30 / 9);
        expect(f({zoom: 3}, undefined)).toBeCloseTo(6);
        expect(f({zoom: 4}, undefined)).toBeCloseTo(6);

    });

    test('one stop', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toBe(2);
        expect(f({zoom: 1}, undefined)).toBe(2);
        expect(f({zoom: 2}, undefined)).toBe(2);

    });

    test('two stops', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toBe(2);
        expect(f({zoom: 1}, undefined)).toBe(2);
        expect(f({zoom: 2}, undefined)).toBe(4);
        expect(f({zoom: 3}, undefined)).toBe(6);
        expect(f({zoom: 4}, undefined)).toBe(6);

    });

    test('three stops', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toBe(2);
        expect(f({zoom: 1}, undefined)).toBe(2);
        expect(f({zoom: 2}, undefined)).toBe(4);
        expect(f({zoom: 2.5}, undefined)).toBe(5);
        expect(f({zoom: 3}, undefined)).toBe(6);
        expect(f({zoom: 4}, undefined)).toBe(8);
        expect(f({zoom: 4.5}, undefined)).toBe(9);
        expect(f({zoom: 5}, undefined)).toBe(10);
        expect(f({zoom: 6}, undefined)).toBe(10);

    });

    test('four stops', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [3, 6], [5, 10], [7, 14]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toBe(2);
        expect(f({zoom: 1}, undefined)).toBe(2);
        expect(f({zoom: 2}, undefined)).toBe(4);
        expect(f({zoom: 2.5}, undefined)).toBe(5);
        expect(f({zoom: 3}, undefined)).toBe(6);
        expect(f({zoom: 3.5}, undefined)).toBe(7);
        expect(f({zoom: 4}, undefined)).toBe(8);
        expect(f({zoom: 4.5}, undefined)).toBe(9);
        expect(f({zoom: 5}, undefined)).toBe(10);
        expect(f({zoom: 6}, undefined)).toBe(12);
        expect(f({zoom: 6.5}, undefined)).toBe(13);
        expect(f({zoom: 7}, undefined)).toBe(14);
        expect(f({zoom: 8}, undefined)).toBe(14);

    });

    test('many stops', () => {
        const stops = [
            [2, 100],
            [55, 200],
            [132, 300],
            [607, 400],
            [1287, 500],
            [1985, 600],
            [2650, 700],
            [3299, 800],
            [3995, 900],
            [4927, 1000],
            [7147, 10000], // 10
            [10028, 100000], // 11
            [12889, 1000000],
            [40000, 10000000]
        ];
        const f = createFunction({
            type: 'exponential',
            stops
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 2}, undefined)).toBeCloseTo(100); //, 1e-6);
        expect(f({zoom: 20}, undefined)).toBeCloseTo(133.9622641509434);
        expect(f({zoom: 607}, undefined)).toBeCloseTo(400);
        expect(f({zoom: 680}, undefined)).toBeCloseTo(410.7352941176471);
        expect(f({zoom: 4927}, undefined)).toBeCloseTo(1000);  //86
        expect(f({zoom: 7300}, undefined)).toBeCloseTo(14779.590419993057);
        expect(f({zoom: 10000}, undefined)).toBeCloseTo(99125.30371398819);
        expect(f({zoom: 20000}, undefined)).toBeCloseTo(3360628.527166095);
        expect(f({zoom: 40000}, undefined)).toBeCloseTo(10000000);

    });

    test('color', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toEqual(new Color(1, 0, 0, 1));
        expect(f({zoom: 5}, undefined)).toEqual(new Color(0.6, 0, 0.4, 1));
        expect(f({zoom: 11}, undefined)).toEqual(new Color(0, 0, 1, 1));

    });

    test('lab colorspace', () => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, 'rgba(0,0,0,1)'], [10, 'rgba(0,255,255,1)']]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toEqual(new Color(0, 0, 0, 1));
        expect(f({zoom: 5}, undefined).r).toBeCloseTo(0);
        expect(f({zoom: 5}, undefined).g).toBeCloseTo(0.444);
        expect(f({zoom: 5}, undefined).b).toBeCloseTo(0.444);

    });

    test('rgb colorspace', () => {
        const f = createFunction({
            type: 'exponential',
            colorSpace: 'rgb',
            stops: [[0, 'rgba(0,0,0,1)'], [10, 'rgba(255,255,255,1)']]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 5}, undefined)).toEqual(new Color(0.5, 0.5, 0.5, 1));

    });

    test('unknown color spaces', () => {
        expect(() => {
            createFunction({
                type: 'exponential',
                colorSpace: 'unknown',
                stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
            }, {
                type: 'color'
            });
        }).toThrow();

    });

    test('interpolation mutation avoidance', () => {
        const params = {
            type: 'exponential',
            colorSpace: 'lab',
            stops: [[1, [0, 0, 0, 1]], [10, [0, 1, 1, 1]]]
        };
        const paramsCopy = JSON.parse(JSON.stringify(params));
        createFunction(params, {
            type: 'color'
        });
        expect(params).toEqual(paramsCopy);
    });

    test('padding', () => {
        const f = createFunction({
            type: 'exponential',
            stops: [[1, 2], [11, [2, 5, 2, 7]]]
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toEqual(new Padding([2, 2, 2, 2]));
        expect(f({zoom: 5}, undefined)).toEqual(new Padding([2, 3.2, 2, 4]));
        expect(f({zoom: 11}, undefined)).toEqual(new Padding([2, 5, 2, 7]));
    });

    test('property present', () => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(2);

    });

    test('property absent, function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]],
            default: 3
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe(3);

    });

    test('property absent, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'number',
            default: 3
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe(3);

    });

    test('property type mismatch, function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]],
            default: 3
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'string'}})).toBe(3);

    });

    test('property type mismatch, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'exponential',
            stops: [[0, 0], [1, 2]]
        }, {
            type: 'string',
            default: 3
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'string'}})).toBe(3);

    });

    test('zoom-and-property function, one stop', () => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            stops: [[{zoom: 1, value: 1}, 2]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {prop: 0}})).toBe(2);
        expect(f({zoom: 1}, {properties: {prop: 0}})).toBe(2);
        expect(f({zoom: 2}, {properties: {prop: 0}})).toBe(2);
        expect(f({zoom: 0}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 1}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 2}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 0}, {properties: {prop: 2}})).toBe(2);
        expect(f({zoom: 1}, {properties: {prop: 2}})).toBe(2);
        expect(f({zoom: 2}, {properties: {prop: 2}})).toBe(2);

    });

    test('zoom-and-property function, two stops', () => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{zoom: 1, value: 0}, 0],
                [{zoom: 1, value: 2}, 4],
                [{zoom: 3, value: 0}, 0],
                [{zoom: 3, value: 2}, 12]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 1}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 2}, {properties: {prop: 1}})).toBe(4);
        expect(f({zoom: 3}, {properties: {prop: 1}})).toBe(6);
        expect(f({zoom: 4}, {properties: {prop: 1}})).toBe(6);

        expect(f({zoom: 2}, {properties: {prop: -1}})).toBe(0);
        expect(f({zoom: 2}, {properties: {prop: 0}})).toBe(0);
        expect(f({zoom: 2}, {properties: {prop: 2}})).toBe(8);
        expect(f({zoom: 2}, {properties: {prop: 3}})).toBe(8);

    });

    test('zoom-and-property function, three stops', () => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{zoom: 1, value: 0}, 0],
                [{zoom: 1, value: 2}, 4],
                [{zoom: 3, value: 0}, 0],
                [{zoom: 3, value: 2}, 12],
                [{zoom: 5, value: 0}, 0],
                [{zoom: 5, value: 2}, 20]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 1}, {properties: {prop: 1}})).toBe(2);
        expect(f({zoom: 2}, {properties: {prop: 1}})).toBe(4);

    });

    test('zoom-and-property function, two stops, fractional zoom', () => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{zoom: 1.9, value: 0}, 4],
                [{zoom: 2.1, value: 0}, 8]
            ]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 1.9}, {properties: {prop: 1}})).toBe(4);
        expect(f({zoom: 2}, {properties: {prop: 1}})).toBe(6);
        expect(f({zoom: 2.1}, {properties: {prop: 1}})).toBe(8);

    });

    test('zoom-and-property function, four stops, integer and fractional zooms', () => {
        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{zoom: 1, value: 0}, 0],
                [{zoom: 1.5, value: 0}, 1],
                [{zoom: 2, value: 0}, 10],
                [{zoom: 2.5, value: 0}, 20]
            ]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 1}, {properties: {prop: 0}})).toBe(0);
        expect(f({zoom: 1.5}, {properties: {prop: 0}})).toBe(1);
        expect(f({zoom: 2}, {properties: {prop: 0}})).toBe(10);
        expect(f({zoom: 2.5}, {properties: {prop: 0}})).toBe(20);

    });

    test('zoom-and-property function, no default', () => {
        // This can happen for fill-outline-color, where the spec has no default.

        const f = createFunction({
            type: 'exponential',
            property: 'prop',
            base: 1,
            stops: [
                [{zoom: 0, value: 1}, 'red'],
                [{zoom: 1, value: 1}, 'red']
            ]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBeUndefined();
        expect(f({zoom: 0.5}, {properties: {}})).toBeUndefined();
        expect(f({zoom: 1}, {properties: {}})).toBeUndefined();

    });

});

describe('interval function', () => {
    test('is the default for non-interpolated properties', () => {
        const f = createFunction({
            stops: [[-1, 11], [0, 111]]
        }, {
            type: 'number',
            'property-type': 'data-constant',
            expression: {
                'interpolated': false,
                'parameters': ['zoom']
            }
        }).evaluate;

        expect(f({zoom: -1.5}, undefined)).toBe(11);
        expect(f({zoom: -0.5}, undefined)).toBe(11);
        expect(f({zoom: 0}, undefined)).toBe(111);
        expect(f({zoom: 0.5}, undefined)).toBe(111);

    });

    test('one stop', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[0, 11]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: -0.5}, undefined)).toBe(11);
        expect(f({zoom: 0}, undefined)).toBe(11);
        expect(f({zoom: 0.5}, undefined)).toBe(11);

    });

    test('two stops', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: -1.5}, undefined)).toBe(11);
        expect(f({zoom: -0.5}, undefined)).toBe(11);
        expect(f({zoom: 0}, undefined)).toBe(111);
        expect(f({zoom: 0.5}, undefined)).toBe(111);

    });

    test('three stops', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: -1.5}, undefined)).toBe(11);
        expect(f({zoom: -0.5}, undefined)).toBe(11);
        expect(f({zoom: 0}, undefined)).toBe(111);
        expect(f({zoom: 0.5}, undefined)).toBe(111);
        expect(f({zoom: 1}, undefined)).toBe(1111);
        expect(f({zoom: 1.5}, undefined)).toBe(1111);

    });

    test('four stops', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[-1, 11], [0, 111], [1, 1111], [2, 11111]]
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: -1.5}, undefined)).toBe(11);
        expect(f({zoom: -0.5}, undefined)).toBe(11);
        expect(f({zoom: 0}, undefined)).toBe(111);
        expect(f({zoom: 0.5}, undefined)).toBe(111);
        expect(f({zoom: 1}, undefined)).toBe(1111);
        expect(f({zoom: 1.5}, undefined)).toBe(1111);
        expect(f({zoom: 2}, undefined)).toBe(11111);
        expect(f({zoom: 2.5}, undefined)).toBe(11111);

    });

    test('color', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[1, 'red'], [11, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toEqual(new Color(1, 0, 0, 1));
        expect(f({zoom: 10}, undefined)).toEqual(new Color(1, 0, 0, 1));
        expect(f({zoom: 11}, undefined)).toEqual(new Color(0, 0, 1, 1));

    });

    test('padding', () => {
        const f = createFunction({
            type: 'interval',
            stops: [[1, 2], [11, 4]]
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, undefined)).toEqual(new Padding([2, 2, 2, 2]));
        expect(f({zoom: 10}, undefined)).toEqual(new Padding([2, 2, 2, 2]));
        expect(f({zoom: 11}, undefined)).toEqual(new Padding([4, 4, 4, 4]));
    });

    test('property present', () => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 1.5}})).toBe('good');

    });

    test('property absent, function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe('default');

    });

    test('property absent, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe('default');

    });

    test('property type mismatch, function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'string'}})).toBe('default');

    });

    test('property type mismatch, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'interval',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'string'}})).toBe('default');

    });

});

describe('categorical function', () => {
    test('string', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'bad'], [1, 'good'], [2, 'bad']]
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe('bad');
        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe('good');
        expect(f({zoom: 0}, {properties: {foo: 2}})).toBe('bad');

    });

    test('string function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe('default');
        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe('default');

    });

    test('string zoom-and-property function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[{zoom: 0, value: 'bar'}, 'zero']],
            default: 'default'
        }, {
            type: 'string',
            function: 'interval'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe('default');
        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe('default');
        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toBe('zero');

    });

    test('strict type checking', () => {
        const numberKeys = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        const stringKeys = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [['0', 'zero'], ['1', 'one'], ['2', 'two'], ['true', 'yes'], ['false', 'no']],
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        expect(numberKeys(0 as any, {properties: {foo: '0'}})).toBe('default');
        expect(numberKeys(0 as any, {properties: {foo: '1'}})).toBe('default');
        expect(numberKeys(0 as any, {properties: {foo: false}})).toBe('default');
        expect(numberKeys(0 as any, {properties: {foo: true}})).toBe('default');

        expect(stringKeys(0 as any, {properties: {foo: 0}})).toBe('default');
        expect(stringKeys(0 as any, {properties: {foo: 1}})).toBe('default');
        expect(stringKeys(0 as any, {properties: {foo: false}})).toBe('default');
        expect(stringKeys(0 as any, {properties: {foo: true}})).toBe('default');

    });

    test('string spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'zero'], [1, 'one'], [2, 'two']]
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe('default');
        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe('default');

    });

    test('color', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']]
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(new Color(1, 0, 0, 1));
        expect(f({zoom: 1}, {properties: {foo: 1}})).toEqual(new Color(0, 0, 1, 1));

    });

    test('color function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']],
            default: 'lime'
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Color(0, 1, 0, 1));
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(new Color(0, 1, 0, 1));

    });

    test('color spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 'red'], [1, 'blue']]
        }, {
            type: 'color',
            default: 'lime'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Color(0, 1, 0, 1));
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(new Color(0, 1, 0, 1));

    });

    test('padding', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 2], [1, 4]]
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 0}})).toEqual(new Padding([2, 2, 2, 2]));
        expect(f({zoom: 1}, {properties: {foo: 1}})).toEqual(new Padding([4, 4, 4, 4]));
    });

    test('padding function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 2], [1, 4]],
            default: 6
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Padding([6, 6, 6, 6]));
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(new Padding([6, 6, 6, 6]));
    });

    test('padding spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[0, 2], [1, 4]]
        }, {
            type: 'padding',
            default: 6
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Padding([6, 6, 6, 6]));
        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(new Padding([6, 6, 6, 6]));
    });

    test('boolean', () => {
        const f = createFunction({
            property: 'foo',
            type: 'categorical',
            stops: [[true, 'true'], [false, 'false']]
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: true}})).toBe('true');
        expect(f({zoom: 0}, {properties: {foo: false}})).toBe('false');

    });

});

describe('identity function', () => {
    test('number', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'number'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 1}})).toBe(1);

    });

    test('number function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 1
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe(1);

    });

    test('number spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 1
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toBe(1);

    });

    test('color', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'red'}})).toEqual(new Color(1, 0, 0, 1));
        expect(f({zoom: 1}, {properties: {foo: 'blue'}})).toEqual(new Color(0, 0, 1, 1));

    });

    test('color function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'red'
        }, {
            type: 'color'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Color(1, 0, 0, 1));

    });

    test('color spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Color(1, 0, 0, 1));

    });

    test('color invalid', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'color',
            default: 'red'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'invalid'}})).toEqual(new Color(1, 0, 0, 1));

    });

    test('padding', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 3}})).toEqual(new Padding([3, 3, 3, 3]));
        expect(f({zoom: 1}, {properties: {foo: [3, 4]}})).toEqual(new Padding([3, 4, 3, 4]));
    });

    test('padding function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: [1, 2, 3, 4]
        }, {
            type: 'padding'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Padding([1, 2, 3, 4]));
    });

    test('padding spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'padding',
            default: [1, 2, 3, 4]
        }).evaluate;

        expect(f({zoom: 0}, {properties: {}})).toEqual(new Padding([1, 2, 3, 4]));
    });

    test('padding invalid', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'padding',
            default: [1, 2, 3, 4]
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'invalid'}})).toEqual(new Padding([1, 2, 3, 4]));
    });

    test('property type mismatch, function default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity',
            default: 'default'
        }, {
            type: 'string'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe('default');

    });

    test('property type mismatch, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'string',
            default: 'default'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 0}})).toBe('default');

    });

    test('valid enum', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'bar'}})).toBe('bar');

    });

    test('invalid enum, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'baz'}})).toBe('def');

    });

    test('invalid type for enum, spec default', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'enum',
            values: {
                bar: {}
            },
            default: 'def'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 3}})).toBe('def');

    });

    test('formatted', () => {
        const f = createFunction({
            property: 'foo',
            type: 'identity'
        }, {
            type: 'formatted'
        }).evaluate;

        expect(f({zoom: 0}, {properties: {foo: 'foo'}})).toEqual(Formatted.fromString('foo'));
        expect(f({zoom: 1}, {properties: {foo: 'bar'}})).toEqual(Formatted.fromString('bar'));
        expect(f({zoom: 2}, {properties: {foo: 2}})).toEqual(Formatted.fromString('2'));
        expect(f({zoom: 3}, {properties: {foo: true}})).toEqual(Formatted.fromString('true'));

    });

});

describe('unknown function', () => {
    expect(() => createFunction({
        type: 'nonesuch', stops: [[]]
    }, {
        type: 'string'
    })).toThrow(/Unknown function type "nonesuch"/);
});

describe('kind', () => {
    test('camera', () => {
        const f = createFunction({
            stops: [[1, 1]]
        }, {
            type: 'number'
        });

        expect(f.kind).toBe('camera');
    });

    test('source', () => {
        const f = createFunction({
            stops: [[1, 1]],
            property: 'mapbox'
        }, {
            type: 'number'
        });

        expect(f.kind).toBe('source');
    });

    test('composite', () => {
        const f = createFunction({
            stops: [[{zoom: 1, value: 1}, 1]],
            property: 'mapbox'
        }, {
            type: 'number'
        });

        expect(f.kind).toBe('composite');
    });

});
