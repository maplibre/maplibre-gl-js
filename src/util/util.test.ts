import {describe, beforeEach, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {arraysIntersect, bezier, clamp, clone, deepEqual, easeCubicInOut, extend, filterObject, findLineIntersection, isCounterClockwise, isPowerOfTwo, keysDifference, mapObject, nextPowerOfTwo, parseCacheControl, pick, readImageDataUsingOffscreenCanvas, readImageUsingVideoFrame, uniqueId, wrap, mod, distanceOfAnglesRadians, distanceOfAnglesDegrees, differenceOfAnglesRadians, differenceOfAnglesDegrees, solveQuadratic, remapSaturate, getEdgeTiles, radiansToDegrees, degreesToRadians, rollPitchBearingToQuat, getRollPitchBearing, getAngleDelta, scaleZoom, zoomScale, threePlaneIntersection, pointPlaneSignedDistance} from './util';
import {Canvas} from 'canvas';
import {OverscaledTileID} from '../tile/tile_id';
import {expectToBeCloseToArray} from './test/util';
import {vec3, type vec4} from 'gl-matrix';

describe('util', () => {
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.2)).toBe(0.03200000000000001);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(1)).toBe(1);
    expect(keysDifference({a: 1}, {})).toEqual(['a']);
    expect(keysDifference({a: 1}, {a: 1})).toEqual([]);
    expect(extend({a: 1}, {b: 2})).toEqual({a: 1, b: 2});
    expect(pick({a: 1, b: 2, c: 3}, ['a', 'c'])).toEqual({a: 1, c: 3});
    expect(pick({a: 1, b: 2, c: 3}, ['a', 'c', 'd'] as any)).toEqual({a: 1, c: 3});
    expect(typeof uniqueId() === 'number').toBeTruthy();

    test('isPowerOfTwo', () => {
        expect(isPowerOfTwo(1)).toBe(true);
        expect(isPowerOfTwo(2)).toBe(true);
        expect(isPowerOfTwo(256)).toBe(true);
        expect(isPowerOfTwo(-256)).toBe(false);
        expect(isPowerOfTwo(0)).toBe(false);
        expect(isPowerOfTwo(-42)).toBe(false);
        expect(isPowerOfTwo(42)).toBe(false);
    });

    test('nextPowerOfTwo', () => {
        expect(nextPowerOfTwo(1)).toBe(1);
        expect(nextPowerOfTwo(2)).toBe(2);
        expect(nextPowerOfTwo(256)).toBe(256);
        expect(nextPowerOfTwo(-256)).toBe(1);
        expect(nextPowerOfTwo(0)).toBe(1);
        expect(nextPowerOfTwo(-42)).toBe(1);
        expect(nextPowerOfTwo(42)).toBe(64);
    });

    test('nextPowerOfTwo', () => {
        expect(isPowerOfTwo(nextPowerOfTwo(1))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(2))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-256))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(0))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(-42))).toBe(true);
        expect(isPowerOfTwo(nextPowerOfTwo(42))).toBe(true);
    });

    test('clamp', () => {
        expect(clamp(0, 0, 1)).toBe(0);
        expect(clamp(1, 0, 1)).toBe(1);
        expect(clamp(200, 0, 180)).toBe(180);
        expect(clamp(-200, 0, 180)).toBe(0);
    });

    test('wrap', () => {
        expect(wrap(0, 0, 1)).toBe(1);
        expect(wrap(1, 0, 1)).toBe(1);
        expect(wrap(200, 0, 180)).toBe(20);
        expect(wrap(-200, 0, 180)).toBe(160);
    });

    test('bezier', () => {
        const curve = bezier(0, 0, 0.25, 1);
        expect(curve instanceof Function).toBeTruthy();
        expect(curve(0)).toBe(0);
        expect(curve(1)).toBe(1);
        expect(curve(0.5)).toBe(0.8230854638965502);
    });

    test('mapObject', () => {
        expect.assertions(5);
        expect(mapObject({}, () => { expect(false).toBeTruthy(); })).toEqual({});
        const that = {};
        expect(mapObject({map: 'box'}, (value, key, object) => {
            expect(value).toBe('box');
            expect(key).toBe('map');
            expect(object).toEqual({map: 'box'});
            return 'BOX';
        }, that)).toEqual({map: 'BOX'});
    });

    test('filterObject', () => {
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
    });

    test('deepEqual', () => {
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
    });

    test('mod', () => {
        expect(mod(2, 3)).toBe(2);
        expect(mod(4, 3)).toBe(1);
        expect(mod(-1, 3)).toBe(2);
        expect(mod(-1, 3)).toBe(2);
    });

    test('degreesToRadians', () => {
        expect(degreesToRadians(1.0)).toBe(Math.PI / 180.0);
    });

    test('radiansToDegrees', () => {
        expect(radiansToDegrees(1.0)).toBe(180.0 / Math.PI);
    });

    test('distanceOfAnglesRadians', () => {
        const digits = 10;
        expect(distanceOfAnglesRadians(0, 1)).toBeCloseTo(1, digits);
        expect(distanceOfAnglesRadians(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, digits);
        expect(distanceOfAnglesRadians(0.5, -0.5)).toBeCloseTo(1, digits);
        expect(distanceOfAnglesRadians(-0.5, 0.5)).toBeCloseTo(1, digits);
    });

    test('distanceOfAnglesDegrees', () => {
        const digits = 10;
        expect(distanceOfAnglesDegrees(0, 1)).toBeCloseTo(1, digits);
        expect(distanceOfAnglesDegrees(10, 350)).toBeCloseTo(20, digits);
        expect(distanceOfAnglesDegrees(0.5, -0.5)).toBeCloseTo(1, digits);
        expect(distanceOfAnglesDegrees(-0.5, 0.5)).toBeCloseTo(1, digits);
    });

    test('differenceOfAnglesRadians', () => {
        const digits = 10;
        expect(differenceOfAnglesRadians(0, 1)).toBeCloseTo(1, digits);
        expect(differenceOfAnglesRadians(0, -1)).toBeCloseTo(-1, digits);
        expect(differenceOfAnglesRadians(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(-0.2, digits);
    });

    test('differenceOfAnglesDegrees', () => {
        const digits = 10;
        expect(differenceOfAnglesDegrees(0, 1)).toBeCloseTo(1, digits);
        expect(differenceOfAnglesDegrees(0, -1)).toBeCloseTo(-1, digits);
        expect(differenceOfAnglesDegrees(10, 350)).toBeCloseTo(-20, digits);
    });

    test('solveQuadratic', () => {
        expect(solveQuadratic(0, 0, 0)).toBeNull();
        expect(solveQuadratic(1, 0, 1)).toBeNull();
        expect(solveQuadratic(1, 0, -1)).toEqual({t0: 1, t1: 1});
        expect(solveQuadratic(1, -8, 12)).toEqual({t0: 2, t1: 6});
    });

    test('remapSaturate', () => {
        expect(remapSaturate(0, 0, 1, 2, 3)).toBe(2);
        expect(remapSaturate(1, 0, 2, 2, 3)).toBe(2.5);
        expect(remapSaturate(999, 0, 2, 2, 3)).toBe(3);
        expect(remapSaturate(1, 1, 0, 2, 3)).toBe(2);
        expect(remapSaturate(1, 0, 1, 3, 2)).toBe(2);
        expect(remapSaturate(1, 1, 0, 3, 2)).toBe(3);
    });
});

describe('util clone', () => {
    test('array', () => {
        const input = [false, 1, 'two'];
        const output = clone(input);
        expect(input).not.toBe(output);
        expect(input).toEqual(output);
    });

    test('object', () => {
        const input = {a: false, b: 1, c: 'two'};
        const output = clone(input);
        expect(input).not.toBe(output);
        expect(input).toEqual(output);
    });

    test('deep object', () => {
        const input = {object: {a: false, b: 1, c: 'two'}};
        const output = clone(input);
        expect(input.object).not.toBe(output.object);
        expect(input.object).toEqual(output.object);
    });

    test('deep array', () => {
        const input = {array: [false, 1, 'two']};
        const output = clone(input);
        expect(input.array).not.toBe(output.array);
        expect(input.array).toEqual(output.array);
    });
});

describe('util arraysIntersect', () => {
    test('intersection', () => {
        const a = ['1', '2', '3'];
        const b = ['5', '4', '3'];

        expect(arraysIntersect(a, b)).toBe(true);
    });

    test('no intersection', () => {
        const a = ['1', '2', '3'];
        const b = ['4', '5', '6'];

        expect(arraysIntersect(a, b)).toBe(false);
    });
});

describe('util isCounterClockwise', () => {
    test('counter clockwise', () => {
        const a = new Point(0, 0);
        const b = new Point(1, 0);
        const c = new Point(1, 1);

        expect(isCounterClockwise(a, b, c)).toBe(true);
    });

    test('clockwise', () => {
        const a = new Point(0, 0);
        const b = new Point(1, 0);
        const c = new Point(1, 1);

        expect(isCounterClockwise(c, b, a)).toBe(false);
    });
});

describe('util getEdgeTiles', () => {
    const makeTile = (z: number, x: number, y: number): OverscaledTileID => {
        return new OverscaledTileID(z, 0, z, x, y);
    };
    const arrayKeys = (tileIDs: OverscaledTileID[]) => {
        return tileIDs.map(id => id.key).sort();
    };
    const setKeys = (tileIDs: Set<OverscaledTileID>) => {
        return Array.from(tileIDs).map(id => id.key).sort();
    };

    test('returns [] for empty input', () => {
        expect(getEdgeTiles([])).toEqual(new Set<OverscaledTileID>());
    });

    test('returns all edge tiles at same zoom', () => {
        const tiles = [
            makeTile(2, 0, 0),
            makeTile(2, 1, 0),
            makeTile(2, 0, 1),
            makeTile(2, 1, 1),
        ];
        const edges = getEdgeTiles(tiles);
        expect(setKeys(edges)).toEqual(arrayKeys(tiles));
    });

    test('returns only edge tiles for a 3x3 block at the same zoom', () => {
        // 3x3 block of tiles at z=3
        const tiles: OverscaledTileID[] = [];
        for (let x = 4; x <= 6; x++) {
            for (let y = 4; y <= 6; y++) {
                tiles.push(makeTile(3, x, y));
            }
        }

        const edges = getEdgeTiles(tiles);

        // expected: 8 perimeter tiles (center tile (5,5) is not on any edge)
        const expected = tiles.filter(id => {
            const {x, y} = id.canonical;
            return !(x === 5 && y === 5);
        });

        expect(setKeys(edges)).toEqual(arrayKeys(expected));
    });

    test('returns only perimeter tiles when mixing coarse and fine', () => {
        const coarse = [
            makeTile(2, 0, 0),
            makeTile(2, 1, 0),
            makeTile(2, 0, 1),
            makeTile(2, 1, 1)
        ];
        const fine = [
            makeTile(3, 4, 4),
            makeTile(3, 5, 4),
            makeTile(3, 4, 5),
            makeTile(3, 5, 5)
        ];

        const allTiles = [...coarse, ...fine];
        const edges = getEdgeTiles(allTiles);

        // expected: drop (z=2, x=1, y=1) and (z=3, x=4, y=4)
        const expected = allTiles.filter(id => {
            const {x, y, z} = id.canonical;
            return !(z === 2 && x === 1 && y === 1) &&
                   !(z === 3 && x === 4 && y === 4);
        });

        expect(setKeys(edges)).toEqual(arrayKeys(expected));
    });
});

describe('util parseCacheControl', () => {
    test('max-age', () => {
        expect(parseCacheControl('max-age=123456789')).toEqual({
            'max-age': 123456789
        });

        expect(parseCacheControl('max-age=1000')).toEqual({
            'max-age': 1000
        });

        expect(parseCacheControl('max-age=null')).toEqual({});
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
        copyTo: vi.fn(buf => {
            buf.set(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]).subarray(0, buf.length));
            return Promise.resolve();
        }),
        close: vi.fn(),
    };
    // return the same frame object each time to allow checking of mock calls
    global.VideoFrame = vi.fn(function() {
        return frame;
    }) as any;
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
        global.OffscreenCanvas = Canvas as any;
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

describe('util rotations', () => {
    test('rollPitchBearingToQuat', () => {
        const roll = 10;
        const pitch = 20;
        const bearing = 30;

        const rotation = rollPitchBearingToQuat(roll, pitch, bearing);
        const angles = getRollPitchBearing(rotation);

        expect(angles.roll).toBeCloseTo(roll, 6);
        expect(angles.pitch).toBeCloseTo(pitch, 6);
        expect(angles.bearing).toBeCloseTo(bearing, 6);
    });

    test('rollPitchBearingToQuat sinuglarity', () => {
        const roll = 10;
        const pitch = 0;
        const bearing = 30;

        const rotation = rollPitchBearingToQuat(roll, pitch, bearing);
        const angles = getRollPitchBearing(rotation);

        expect(angles.pitch).toBeCloseTo(0, 5);
        expect(wrap(angles.bearing + angles.roll, -180, 180)).toBeCloseTo(wrap(bearing + roll, -180, 180), 6);
    });
});

describe('util getAngleDelta', () => {
    test('positive direction', () => {
        const lastPoint = new Point(0, 1);
        const currentPoint = new Point(1, 0);
        const center = new Point(0, 0);

        expect(getAngleDelta(lastPoint, currentPoint, center)).toBe(90);
    });

    test('positive direction', () => {
        const lastPoint = new Point(1, 0);
        const currentPoint = new Point(0, 1);
        const center = new Point(0, 0);

        expect(getAngleDelta(lastPoint, currentPoint, center)).toBe(-90);
    });
});
describe('util scaleZoom and zoomScale relation', () => {
    test('convert and back', () => {
        expect(scaleZoom(0)).toBe(-Infinity);
        expect(scaleZoom(10)).toBe(3.3219280948873626);
        expect(zoomScale(3.3219280948873626)).toBeCloseTo(10, 10);
        expect(scaleZoom(zoomScale(5))).toBe(5);
    });
});

describe('threePlaneIntersection', () => {
    const precision = 10;

    function createPlane(origin: number[], direction: number[]): vec4 {
        const normalized = vec3.normalize([] as any, direction as vec3);
        const dist = vec3.dot(normalized, origin as vec3);
        return [normalized[0], normalized[1], normalized[2], -dist];
    }

    test('plane creation helper function', () => {
        const origin = [-4, 5, -6];
        const plane = createPlane(origin, [1, 2, 3]);
        // Plane direction is normalized
        expect(vec3.length([plane[0], plane[1], plane[2]])).toBeCloseTo(1, precision);
        // Plane behaves as expected around the origin point
        expect(pointPlaneSignedDistance(plane, origin as vec3)).toBe(0);
        expect(pointPlaneSignedDistance(plane, [-4 + 1, 5 + 2, -6 + 3] as vec3)).toBeGreaterThan(0);
        expect(pointPlaneSignedDistance(plane, [-4 - 1, 5 - 2, -6 - 3] as vec3)).toBeLessThan(0);
    });

    test('three orthogonal planes at origin', () => {
        const plane1 = [1, 0, 0, 0] as vec4;
        const plane2 = [0, 1, 0, 0] as vec4;
        const plane3 = [0, 0, 1, 0] as vec4;
        expectToBeCloseToArray([...threePlaneIntersection(plane1, plane2, plane3)], [0, 0, 0], precision);
    });

    test('three translated orthogonal planes', () => {
        const plane1 = [1, 0, 0, -3] as vec4;
        const plane2 = [0, 1, 0, -4] as vec4;
        const plane3 = [0, 0, 1, -5] as vec4;
        expectToBeCloseToArray([...threePlaneIntersection(plane1, plane2, plane3)], [3, 4, 5], precision);
    });

    test('three rotated planes at origin', () => {
        const origin = [0, 0, 0];
        const plane1 = createPlane(origin, [1, 2, 3]);
        const plane2 = createPlane(origin, [-4, 5, 6]);
        const plane3 = createPlane(origin, [7, -8, 9]);
        expectToBeCloseToArray([...threePlaneIntersection(plane1, plane2, plane3)], origin, precision);
    });

    test('three rotated planes placed arbitrarily', () => {
        const origin = [-4, 5, -6];
        const plane1 = createPlane(origin, [1, 2, 3]);
        const plane2 = createPlane(origin, [-4, 5, 6]);
        const plane3 = createPlane(origin, [7, -8, 9]);
        const intersection = threePlaneIntersection(plane1, plane2, plane3);
        expect(pointPlaneSignedDistance(plane1, intersection)).toBeCloseTo(0, precision);
        expect(pointPlaneSignedDistance(plane2, intersection)).toBeCloseTo(0, precision);
        expect(pointPlaneSignedDistance(plane3, intersection)).toBeCloseTo(0, precision);
        expectToBeCloseToArray([...intersection], origin, precision);
    });

    test('two parallel planes', () => {
        const plane1 = createPlane([0, 0, 0], [1, 0, 0]);
        const plane2 = createPlane([1, 0, 0], [1, 0, 0]);
        const plane3 = createPlane([1, 0, 0], [0, 1, 0]);
        expect(threePlaneIntersection(plane1, plane2, plane3)).toBeNull();
    });

    test('three parallel planes', () => {
        const plane1 = createPlane([0, 0, 0], [1, 0, 0]);
        const plane2 = createPlane([1, 0, 0], [1, 0, 0]);
        const plane3 = createPlane([2, 0, 0], [1, 0, 0]);
        expect(threePlaneIntersection(plane1, plane2, plane3)).toBeNull();
    });

    test('planes form an infinite triangle wedge', () => {
        const plane1 = createPlane([0, 0, 0], [1, 0, 0]);
        const plane2 = createPlane([0, 0, 0], [0, 1, 0]);
        const plane3 = createPlane([2, 2, 0], [1, 1, 0]);
        expect(threePlaneIntersection(plane1, plane2, plane3)).toBeNull();
    });

    test('planes intersection is a line', () => {
        const plane1 = createPlane([0, 0, 0], [1, 0, 0]);
        const plane2 = createPlane([0, 0, 0], [0, 1, 0]);
        const plane3 = createPlane([0, 0, 0], [1, 1, 0]);
        expect(threePlaneIntersection(plane1, plane2, plane3)).toBeNull();
    });
});
