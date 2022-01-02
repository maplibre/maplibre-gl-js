import {test} from '../../util/test';

import {easeCubicInOut, keysDifference, extend, pick, uniqueId, bindAll, asyncAll, clamp, wrap, bezier, mapObject, filterObject, deepEqual, clone, arraysIntersect, isCounterClockwise, isClosedPolygon, parseCacheControl, nextPowerOfTwo, isPowerOfTwo} from '../../../rollup/build/tsc/src/util/util';
import Point from '../../../rollup/build/tsc/src/util/point';

test('util', (t) => {
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.2)).toBe(0.03200000000000001);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(1)).toBe(1);
    expect(keysDifference({a:1}, {})).toEqual(['a']);
    expect(keysDifference({a:1}, {a:1})).toEqual([]);
    expect(extend({a:1}, {b:2})).toEqual({a:1, b:2});
    expect(pick({a:1, b:2, c:3}, ['a', 'c'])).toEqual({a:1, c:3});
    expect(pick({a:1, b:2, c:3}, ['a', 'c', 'd'])).toEqual({a:1, c:3});
    expect(typeof uniqueId() === 'number').toBeTruthy();

    t.test('bindAll', (t) => {
        function MyClass() {
            bindAll(['ontimer'], this);
            this.name = 'Tom';
        }
        MyClass.prototype.ontimer = function() {
            expect(this.name).toBe('Tom');
            t.end();
        };
        const my = new MyClass();
        setTimeout(my.ontimer, 0);
    });

    t.test('asyncAll - sync', (t) => {
        expect(asyncAll([0, 1, 2], (data, callback) => {
            callback(null, data);
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([0, 1, 2]);
        })).toBeUndefined();
        t.end();
    });

    t.test('asyncAll - async', (t) => {
        expect(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(null, data);
            }, data);
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([4, 0, 1, 2]);
            t.end();
        })).toBeUndefined();
    });

    t.test('asyncAll - error', (t) => {
        expect(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(new Error('hi'), data);
            }, data);
        }, (err, results) => {
            expect(err && err.message).toBe('hi');
            expect(results).toEqual([4, 0, 1, 2]);
            t.end();
        })).toBeUndefined();
    });

    t.test('asyncAll - empty', (t) => {
        expect(asyncAll([], (data, callback) => {
            callback(null, 'foo');
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([]);
        })).toBeUndefined();
        t.end();
    });

    t.test('isPowerOfTwo', (t) => {
        expect(isPowerOfTwo(1)).toBe(true);
        expect(isPowerOfTwo(2)).toBe(true);
        expect(isPowerOfTwo(256)).toBe(true);
        expect(isPowerOfTwo(-256)).toBe(false);
        expect(isPowerOfTwo(0)).toBe(false);
        expect(isPowerOfTwo(-42)).toBe(false);
        expect(isPowerOfTwo(42)).toBe(false);
        t.end();
    });

    t.test('nextPowerOfTwo', (t) => {
        expect(nextPowerOfTwo(1)).toBe(1);
        expect(nextPowerOfTwo(2)).toBe(2);
        expect(nextPowerOfTwo(256)).toBe(256);
        expect(nextPowerOfTwo(-256)).toBe(1);
        expect(nextPowerOfTwo(0)).toBe(1);
        expect(nextPowerOfTwo(-42)).toBe(1);
        expect(nextPowerOfTwo(42)).toBe(64);
        t.end();
    });

    t.test('nextPowerOfTwo', (t) => {
        expect(isPowerOfTwo(nextPowerOfTwo(1))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(2))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(0))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-42))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(42))).toBe(true);
        t.end();
    });

    t.test('clamp', (t) => {
        expect(clamp(0, 0, 1)).toBe(0);
        expect(clamp(1, 0, 1)).toBe(1);
        expect(clamp(200, 0, 180)).toBe(180);
        expect(clamp(-200, 0, 180)).toBe(0);
        t.end();
    });

    t.test('wrap', (t) => {
        expect(wrap(0, 0, 1)).toBe(1);
        expect(wrap(1, 0, 1)).toBe(1);
        expect(wrap(200, 0, 180)).toBe(20);
        expect(wrap(-200, 0, 180)).toBe(160);
        t.end();
    });

    t.test('bezier', (t) => {
        const curve = bezier(0, 0, 0.25, 1);
        expect(curve instanceof Function).toBeTruthy();
        expect(curve(0)).toBe(0);
        expect(curve(1)).toBe(1);
        expect(curve(0.5)).toBe(0.8230854638965502);
        t.end();
    });

    t.test('asyncAll', (t) => {
        let expect = 1;
        asyncAll([], (callback) => { callback(); }, () => {
            expect('immediate callback').toBeTruthy();
        });
        asyncAll([1, 2, 3], (number, callback) => {
            expect(number).toBe(expect++);
            expect(callback instanceof Function).toBeTruthy();
            callback(null, 0);
        }, () => {
            t.end();
        });
    });

    t.test('mapObject', (t) => {
        expect.assertions(6);
        expect(mapObject({}, () => { expect(false).toBeTruthy(); })).toEqual({});
        const that = {};
        expect(mapObject({map: 'box'}, function(value, key, object) {
            expect(value).toBe('box');
            expect(key).toBe('map');
            expect(object).toEqual({map: 'box'});
            expect(this).toBe(that);
            return 'BOX';
        }, that)).toEqual({map: 'BOX'});
    });

    t.test('filterObject', (t) => {
        expect.assertions(6);
        expect(filterObject({}, () => { expect(false).toBeTruthy(); })).toEqual({});
        const that = {};
        filterObject({map: 'box'}, function(value, key, object) {
            expect(value).toBe('box');
            expect(key).toBe('map');
            expect(object).toEqual({map: 'box'});
            expect(this).toBe(that);
            return true;
        }, that);
        expect(filterObject({map: 'box', box: 'map'}, (value) => {
            return value === 'box';
        })).toEqual({map: 'box'});
        t.end();
    });

    t.test('deepEqual', (t) => {
        const a = {
            foo: 'bar',
            bar: {
                baz: 5,
                lol: ['cat', 2]
            }
        };
        const b = JSON.parse(JSON.stringify(a));
        const c = JSON.parse(JSON.stringify(a));
        c.bar.lol[0] = 'z';

        expect(deepEqual(a, b)).toBeTruthy();
        expect(deepEqual(a, c)).toBeFalsy();
        expect(deepEqual(a, null)).toBeFalsy();
        expect(deepEqual(null, c)).toBeFalsy();
        expect(deepEqual(null, null)).toBeTruthy();

        t.end();
    });

    t.test('clone', (t) => {
        t.test('array', (t) => {
            const input = [false, 1, 'two'];
            const output = clone(input);
            expect(input).not.toBe(output);
            expect(input).toEqual(output);
            t.end();
        });

        t.test('object', (t) => {
            const input = {a: false, b: 1, c: 'two'};
            const output = clone(input);
            expect(input).not.toBe(output);
            expect(input).toEqual(output);
            t.end();
        });

        t.test('deep object', (t) => {
            const input = {object: {a: false, b: 1, c: 'two'}};
            const output = clone(input);
            expect(input.object).not.toBe(output.object);
            expect(input.object).toEqual(output.object);
            t.end();
        });

        t.test('deep array', (t) => {
            const input = {array: [false, 1, 'two']};
            const output = clone(input);
            expect(input.array).not.toBe(output.array);
            expect(input.array).toEqual(output.array);
            t.end();
        });

        t.end();
    });

    t.test('arraysIntersect', (t) => {
        t.test('intersection', (t) => {
            const a = ['1', '2', '3'];
            const b = ['5', '4', '3'];

            expect(arraysIntersect(a, b)).toBe(true);
            t.end();
        });

        t.test('no intersection', (t) => {
            const a = ['1', '2', '3'];
            const b = ['4', '5', '6'];

            expect(arraysIntersect(a, b)).toBe(false);
            t.end();
        });

        t.end();
    });

    t.test('isCounterClockwise ', (t) => {
        t.test('counter clockwise', (t) => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            expect(isCounterClockwise(a, b, c)).toBe(true);
            t.end();
        });

        t.test('clockwise', (t) => {
            const a = new Point(0, 0);
            const b = new Point(1, 0);
            const c = new Point(1, 1);

            expect(isCounterClockwise(c, b, a)).toBe(false);
            t.end();
        });

        t.end();
    });

    t.test('isClosedPolygon', (t) => {
        t.test('not enough points', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1)];

            expect(isClosedPolygon(polygon)).toBe(false);
            t.end();
        });

        t.test('not equal first + last point', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)];

            expect(isClosedPolygon(polygon)).toBe(false);
            t.end();
        });

        t.test('closed polygon', (t) => {
            const polygon = [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1), new Point(0, 0)];

            expect(isClosedPolygon(polygon)).toBe(true);
            t.end();
        });

        t.end();
    });

    t.test('parseCacheControl', (t) => {
        t.test('max-age', (t) => {
            expect(parseCacheControl('max-age=123456789')).toEqual({
                'max-age': 123456789
            });

            expect(parseCacheControl('max-age=1000')).toEqual({
                'max-age': 1000
            });

            expect(parseCacheControl('max-age=null')).toEqual({});

            t.end();
        });

        t.end();
    });

    t.end();
});
