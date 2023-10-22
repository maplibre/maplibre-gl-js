import Point from '@mapbox/point-geometry';
import {arraysIntersect, asyncAll, bezier, clamp, clone, deepEqual, easeCubicInOut, extend, filterObject, findLineIntersection, isClosedPolygon, isCounterClockwise, isPowerOfTwo, keysDifference, mapObject, nextPowerOfTwo, parseCacheControl, pick, readImageDataUsingOffscreenCanvas, readImageUsingVideoFrame, uniqueId, wrap} from './util';
import {Canvas} from 'canvas';

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

describe('util findLineIntersection', () => {
    test('line intersection', () => {
        const horizontal = [
            new Point(0, 0),
            new Point(10, 0)];
        const vertical = [
            new Point(30, -20),
            new Point(30, -10)
        ];
        const intersection = findLineIntersection(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(30, 0));
    });

    test('line intersection backwards', () => {
        // Direction of line segments should be irrelevant
        const horizontal = [
            new Point(10, 0),
            new Point(0, 0)];
        const vertical = [
            new Point(30, -10),
            new Point(30, -20)
        ];
        const intersection = findLineIntersection(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(30, 0));
    });

    test('crossing line intersection', () => {
        // This should not be possible for two adjacent segments of a line string
        const horizontal = [
            new Point(-10, 0),
            new Point(10, 0)];
        const vertical = [
            new Point(0, -10),
            new Point(0, 10)
        ];
        const intersection = findLineIntersection(horizontal[0], horizontal[1], vertical[0], vertical[1]);
        expect(intersection).toEqual(new Point(0, 0));
    });

    test('parallel lines do not intersect', () => {
        const first = [
            new Point(0, 0),
            new Point(10, 0)];
        const second = [
            new Point(10, 0),
            new Point(30, 0)
        ];
        const intersection = findLineIntersection(first[0], first[1], second[0], second[1]);
        expect(intersection).toBeNull();
    });
});

describe('util readImageUsingVideoFrame', () => {
    let format = 'RGBA';
    const frame = {
        get format() {
            return format;
        },
        copyTo: jest.fn(buf => {
            buf.set(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).subarray(0, buf.length));
            return Promise.resolve();
        }),
        close: jest.fn(),
    };
    (window as any).VideoFrame = jest.fn(() => frame);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;

    beforeEach(() => {
        format = 'RGBA';
        frame.copyTo.mockClear();
        frame.close.mockReset();
    });

    test('copy RGB', async () => {
        format = 'RGBA';
        const result = await readImageUsingVideoFrame(canvas, 0, 0, 2, 2);
        expect(result).toHaveLength(4 * 4);
        expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
            layout: [{offset: 0, stride: 8}],
            rect: {x: 0, y: 0, width: 2, height: 2}
        });
        expect(result).toEqual(new Uint8ClampedArray([
            1, 2, 3, 4, 5, 6, 7, 8,
            9, 10, 11, 12, 13, 14, 15, 16
        ]));
        expect(frame.close).toHaveBeenCalledTimes(1);
    });

    test('flip BRG', async () => {
        format = 'BGRX';
        const result = await readImageUsingVideoFrame(canvas, 0, 0, 2, 2);
        expect(result).toEqual(new Uint8ClampedArray([
            3, 2, 1, 4, 7, 6, 5, 8,
            11, 10, 9, 12, 15, 14, 13, 16
        ]));
        expect(frame.close).toHaveBeenCalledTimes(1);
    });

    test('ignore bad format', async () => {
        format = 'OTHER';
        await expect(readImageUsingVideoFrame(canvas, 0, 0, 2, 2)).rejects.toThrow();
        expect(frame.close).toHaveBeenCalledTimes(1);
    });

    describe('layout/rect', () => {
        beforeEach(() => {
            (window as any).VideoFrame = jest.fn(() => frame);
            canvas.width = canvas.height = 3;
        });

        test('full rectangle', async () => {
            await readImageUsingVideoFrame(canvas, 0, 0, 3, 3);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 12}],
                rect: {x: 0, y: 0, width: 3, height: 3}
            });
        });

        test('top left', async () => {
            await readImageUsingVideoFrame(canvas, 0, 0, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 8}],
                rect: {x: 0, y: 0, width: 2, height: 2}
            });
        });

        test('top right', async () => {
            await readImageUsingVideoFrame(canvas, 1, 0, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 8}],
                rect: {x: 1, y: 0, width: 2, height: 2}
            });
        });

        test('bottom left', async () => {
            await readImageUsingVideoFrame(canvas, 0, 1, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 8}],
                rect: {x: 0, y: 1, width: 2, height: 2}
            });
        });

        test('bottom right', async () => {
            await readImageUsingVideoFrame(canvas, 1, 1, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 8}],
                rect: {x: 1, y: 1, width: 2, height: 2}
            });
        });

        test('middle', async () => {
            await readImageUsingVideoFrame(canvas, 1, 1, 1, 1);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 4}],
                rect: {x: 1, y: 1, width: 1, height: 1}
            });
        });

        test('extend past on all sides', async () => {
            await readImageUsingVideoFrame(canvas, -1, -1, 5, 5);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 4 * 5 + 4, stride: 4 * 5}],
                rect: {x: 0, y: 0, width: 3, height: 3}
            });
        });

        test('overhang top left', async () => {
            await readImageUsingVideoFrame(canvas, -1, -1, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 4 * 2 + 4, stride: 4 * 2}],
                rect: {x: 0, y: 0, width: 1, height: 1}
            });
        });

        test('overhang top right', async () => {
            await readImageUsingVideoFrame(canvas, 2, -1, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 4 * 2, stride: 4 * 2}],
                rect: {x: 2, y: 0, width: 1, height: 1}
            });
        });

        test('overhang bottom left', async () => {
            await readImageUsingVideoFrame(canvas, -1, 2, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 4, stride: 4 * 2}],
                rect: {x: 0, y: 2, width: 1, height: 1}
            });
        });

        test('overhang bottom right', async () => {
            await readImageUsingVideoFrame(canvas, 2, 2, 2, 2);
            expect(frame.copyTo).toHaveBeenCalledWith(expect.anything(), {
                layout: [{offset: 0, stride: 4 * 2}],
                rect: {x: 2, y: 2, width: 1, height: 1}
            });
        });
    });
});

describe('util readImageDataUsingOffscreenCanvas', () => {
    test('reads pixels from image', async () => {
        (window as any).OffscreenCanvas = Canvas;
        const image = new Canvas(2, 2);
        const context = image.getContext('2d');
        context.fillStyle = 'rgb(10,0,0)';
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = 'rgb(0,20,0)';
        context.fillRect(1, 0, 1, 1);
        context.fillStyle = 'rgb(0,0,30)';
        context.fillRect(0, 1, 1, 1);
        context.fillStyle = 'rgb(40,40,40)';
        context.fillRect(1, 1, 1, 1);
        expect([...await readImageDataUsingOffscreenCanvas(image as any, 0, 0, 2, 2)]).toEqual([
            10, 0, 0, 255, 0, 20, 0, 255,
            0, 0, 30, 255, 40, 40, 40, 255,
        ]);
    });
});
