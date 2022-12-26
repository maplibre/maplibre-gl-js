import {easeCubicInOut, keysDifference, extend, pick, uniqueId, bindAll, asyncAll, clamp, wrap, bezier, mapObject, filterObject, deepEqual, clone, arraysIntersect, isCounterClockwise, isClosedPolygon, parseCacheControl, nextPowerOfTwo, isPowerOfTwo} from './util';
import Point from '@mapbox/point-geometry';

describe('util', () => {
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.2)).toBe(0.03200000000000001);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(1)).toBe(1);
    expect(keysDifference({a: 1}, {})).toEqual(['a']);
    expect(keysDifference({a: 1}, {a: 1})).toEqual([]);
    expect(extend({a: 1}, {b: 2})).toEqual({a: 1, b: 2});
    expect(pick({a: 1, b: 2, c: 3}, ['a', 'c'])).toEqual({a: 1, c: 3});
    expect(pick({a: 1, b: 2, c: 3}, ['a', 'c', 'd'])).toEqual({a: 1, c: 3});
    expect(typeof uniqueId() === 'number').toBeTruthy();

    test('bindAll', done => {
        function MyClass() {
            bindAll(['ontimer'], this);
            this.name = 'Tom';
        }
        MyClass.prototype.ontimer = function() {
            expect(this.name).toBe('Tom');
            done();
        };
        const my = new MyClass();
        setTimeout(my.ontimer, 0);
    });

    test('asyncAll - sync', done => {
        expect(asyncAll([0, 1, 2], (data, callback) => {
            callback(null, data);
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([0, 1, 2]);
        })).toBeUndefined();
        done();
    });

    test('asyncAll - async', done => {
        expect(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(null, data);
            }, data);
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([4, 0, 1, 2]);
            done();
        })).toBeUndefined();
    });

    test('asyncAll - error', done => {
        expect(asyncAll([4, 0, 1, 2], (data, callback) => {
            setTimeout(() => {
                callback(new Error('hi'), data);
            }, data);
        }, (err, results) => {
            expect(err && err.message).toBe('hi');
            expect(results).toEqual([4, 0, 1, 2]);
            done();
        })).toBeUndefined();
    });

    test('asyncAll - empty', done => {
        expect(asyncAll([], (data, callback) => {
            callback(null, 'foo');
        }, (err, results) => {
            expect(err).toBeFalsy();
            expect(results).toEqual([]);
        })).toBeUndefined();
        done();
    });

    test('isPowerOfTwo', done => {
        expect(isPowerOfTwo(1)).toBe(true);
        expect(isPowerOfTwo(2)).toBe(true);
        expect(isPowerOfTwo(256)).toBe(true);
        expect(isPowerOfTwo(-256)).toBe(false);
        expect(isPowerOfTwo(0)).toBe(false);
        expect(isPowerOfTwo(-42)).toBe(false);
        expect(isPowerOfTwo(42)).toBe(false);
        done();
    });

    test('nextPowerOfTwo', done => {
        expect(nextPowerOfTwo(1)).toBe(1);
        expect(nextPowerOfTwo(2)).toBe(2);
        expect(nextPowerOfTwo(256)).toBe(256);
        expect(nextPowerOfTwo(-256)).toBe(1);
        expect(nextPowerOfTwo(0)).toBe(1);
        expect(nextPowerOfTwo(-42)).toBe(1);
        expect(nextPowerOfTwo(42)).toBe(64);
        done();
    });

    test('nextPowerOfTwo', done => {
        expect(isPowerOfTwo(nextPowerOfTwo(1))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(2))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(0))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-42))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(42))).toBe(true);
        done();
    });

    test('clamp', done => {
        expect(clamp(0, 0, 1)).toBe(0);
        expect(clamp(1, 0, 1)).toBe(1);
        expect(clamp(200, 0, 180)).toBe(180);
        expect(clamp(-200, 0, 180)).toBe(0);
        done();
    });

    test('wrap', done => {
        expect(wrap(0, 0, 1)).toBe(1);
        expect(wrap(1, 0, 1)).toBe(1);
        expect(wrap(200, 0, 180)).toBe(20);
        expect(wrap(-200, 0, 180)).toBe(160);
        done();
    });

    test('bezier', done => {
        const curve = bezier(0, 0, 0.25, 1);
        expect(curve instanceof Function).toBeTruthy();
        expect(curve(0)).toBe(0);
        expect(curve(1)).toBe(1);
        expect(curve(0.5)).toBe(0.8230854638965502);
        done();
    });

    test('asyncAll', done => {
        let expectedValue = 1;
        asyncAll([], (callback) => { callback(); }, () => {
            expect('immediate callback').toBeTruthy();
        });
        asyncAll([1, 2, 3], (number, callback) => {
            expect(number).toBe(expectedValue++);
            expect(callback instanceof Function).toBeTruthy();
            callback(null, 0);
        }, () => {
            done();
        });
    });

    test('mapObject', () => {
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

    test('filterObject', done => {
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
        done();
    });

    test('deepEqual', done => {
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

        done();
    });
});

describe('util clone', () => {
    test('array', done => {
        const input = [false, 1, 'two'];
        const output = clone(input);
        expect(input).not.toBe(output);
        expect(input).toEqual(output);
        done();
    });

    test('object', done => {
        const input = {a: false, b: 1, c: 'two'};
        const output = clone(input);
        expect(input).not.toBe(output);
        expect(input).toEqual(output);
        done();
    });

    test('deep object', done => {
        const input = {object: {a: false, b: 1, c: 'two'}};
        const output = clone(input);
        expect(input.object).not.toBe(output.object);
        expect(input.object).toEqual(output.object);
        done();
    });

    test('deep array', done => {
        const input = {array: [false, 1, 'two']};
        const output = clone(input);
        expect(input.array).not.toBe(output.array);
        expect(input.array).toEqual(output.array);
        done();
    });
});

describe('util arraysIntersect', () => {
    test('intersection', done => {
        const a = ['1', '2', '3'];
        const b = ['5', '4', '3'];

        expect(arraysIntersect(a, b)).toBe(true);
        done();
    });

    test('no intersection', done => {
        const a = ['1', '2', '3'];
        const b = ['4', '5', '6'];

        expect(arraysIntersect(a, b)).toBe(false);
        done();
    });

});

describe('util isCounterClockwise', () => {
    test('counter clockwise', done => {
        const a = new Point(0, 0);
        const b = new Point(1, 0);
        const c = new Point(1, 1);

        expect(isCounterClockwise(a, b, c)).toBe(true);
        done();
    });

    test('clockwise', done => {
        const a = new Point(0, 0);
        const b = new Point(1, 0);
        const c = new Point(1, 1);

        expect(isCounterClockwise(c, b, a)).toBe(false);
        done();
    });
});

describe('util isClosedPolygon', () => {
    test('not enough points', done => {
        const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1)];

        expect(isClosedPolygon(polygon)).toBe(false);
        done();
    });

    test('not equal first + last point', done => {
        const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)];

        expect(isClosedPolygon(polygon)).toBe(false);
        done();
    });

    test('closed polygon', done => {
        const polygon = [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1), new Point(0, 0)];

        expect(isClosedPolygon(polygon)).toBe(true);
        done();
    });

});

describe('util parseCacheControl', () => {
    test('max-age', done => {
        expect(parseCacheControl('max-age=123456789')).toEqual({
            'max-age': 123456789
        });

        expect(parseCacheControl('max-age=1000')).toEqual({
            'max-age': 1000
        });

        expect(parseCacheControl('max-age=null')).toEqual({});

        done();
    });

});
