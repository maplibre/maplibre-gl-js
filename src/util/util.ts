import Point from '@mapbox/point-geometry';
import UnitBezier from '@mapbox/unitbezier';
import type {Callback} from '../types/callback';
import {isOffscreenCanvasDistorted} from './offscreen_canvas_distorted';
import type {Size} from './image';

/**
 * Given a value `t` that varies between 0 and 1, return
 * an interpolation function that eases between 0 and 1 in a pleasing
 * cubic in-out fashion.
 */
export function easeCubicInOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const t2 = t * t,
        t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}

/**
 * Given given (x, y), (x1, y1) control points for a bezier curve,
 * return a function that interpolates along that curve.
 *
 * @param p1x - control point 1 x coordinate
 * @param p1y - control point 1 y coordinate
 * @param p2x - control point 2 x coordinate
 * @param p2y - control point 2 y coordinate
 */
export function bezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number {
    const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t: number) {
        return bezier.solve(t);
    };
}

/**
 * A default bezier-curve powered easing function with
 * control points (0.25, 0.1) and (0.25, 1)
 */
export const defaultEasing = bezier(0.25, 0.1, 0.25, 1);

/**
 * constrain n to the given range via min + max
 *
 * @param n - value
 * @param min - the minimum value to be returned
 * @param max - the maximum value to be returned
 * @returns the clamped value
 */
export function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

/**
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 *
 * @param n - value
 * @param min - the minimum value to be returned, exclusive
 * @param max - the maximum value to be returned, inclusive
 * @returns constrained number
 */
export function wrap(n: number, min: number, max: number): number {
    const d = max - min;
    const w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
}

/**
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param array - input to each call of the async function.
 * @param fn - an async function with signature (data, callback)
 * @param callback - a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 */
export function asyncAll<Item, Result>(
    array: Array<Item>,
    fn: (item: Item, fnCallback: Callback<Result>) => void,
    callback: Callback<Array<Result>>
) {
    if (!array.length) { return callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error = null;
    array.forEach((item, i) => {
        fn(item, (err, result) => {
            if (err) error = err;
            results[i] = (result as any as Result); // https://github.com/facebook/flow/issues/2123
            if (--remaining === 0) callback(error, results);
        });
    });
}

/**
 * Compute the difference between the keys in one object and the keys
 * in another object.
 *
 * @returns keys difference
 */
export function keysDifference<S, T>(
    obj: {[key: string]: S},
    other: {[key: string]: T}
): Array<string> {
    const difference = [];
    for (const i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
}

/**
 * Given a destination object and optionally many source objects,
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 *
 * @param dest - destination object
 * @param sources - sources from which properties are pulled
 */
export function extend(dest: any, ...sources: Array<any>): any {
    for (const src of sources) {
        for (const k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
}

/**
 * Given an object and a number of properties as strings, return version
 * of that object with only those properties.
 *
 * @param src - the object
 * @param properties - an array of property names chosen
 * to appear on the resulting object.
 * @returns object with limited properties.
 * @example
 * ```ts
 * let foo = { name: 'Charlie', age: 10 };
 * let justName = pick(foo, ['name']); // justName = { name: 'Charlie' }
 * ```
 */
export function pick(src: any, properties: Array<string>): any {
    const result = {};
    for (let i = 0; i < properties.length; i++) {
        const k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
}

let id = 1;

/**
 * Return a unique numeric id, starting at 1 and incrementing with
 * each call.
 *
 * @returns unique numeric id.
 */
export function uniqueId(): number {
    return id++;
}

/**
 * Return whether a given value is a power of two
 */
export function isPowerOfTwo(value: number): boolean {
    return (Math.log(value) / Math.LN2) % 1 === 0;
}

/**
 * Return the next power of two, or the input value if already a power of two
 */
export function nextPowerOfTwo(value: number): number {
    if (value <= 1) return 1;
    return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}

/**
 * Create an object by mapping all the values of an existing object while
 * preserving their keys.
 */
export function mapObject(input: any, iterator: Function, context?: any): any {
    const output = {};
    for (const key in input) {
        output[key] = iterator.call(context || this, input[key], key, input);
    }
    return output;
}

/**
 * Create an object by filtering out values of an existing object.
 */
export function filterObject(input: any, iterator: Function, context?: any): any {
    const output = {};
    for (const key in input) {
        if (iterator.call(context || this, input[key], key, input)) {
            output[key] = input[key];
        }
    }
    return output;
}

/**
 * Deeply compares two object literals.
 * @param a - first object literal to be compared
 * @param b - second object literal to be compared
 * @returns true if the two object literals are deeply equal, false otherwise
 */
export function deepEqual(a?: unknown | null, b?: unknown | null): boolean {
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        if (!(typeof b === 'object')) return false;
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) return false;
        for (const key in a) {
            if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    return a === b;
}

/**
 * Deeply clones two objects.
 */
export function clone<T>(input: T): T {
    if (Array.isArray(input)) {
        return input.map(clone) as any as T;
    } else if (typeof input === 'object' && input) {
        return mapObject(input, clone) as any as T;
    } else {
        return input;
    }
}

/**
 * Check if two arrays have at least one common element.
 */
export function arraysIntersect<T>(a: Array<T>, b: Array<T>): boolean {
    for (let l = 0; l < a.length; l++) {
        if (b.indexOf(a[l]) >= 0) return true;
    }
    return false;
}

/**
 * Print a warning message to the console and ensure duplicate warning messages
 * are not printed.
 */
const warnOnceHistory: {[key: string]: boolean} = {};

export function warnOnce(message: string): void {
    if (!warnOnceHistory[message]) {
        // console isn't defined in some WebWorkers, see #2558
        if (typeof console !== 'undefined') console.warn(message);
        warnOnceHistory[message] = true;
    }
}

/**
 * Indicates if the provided Points are in a counter clockwise (true) or clockwise (false) order
 *
 * @returns true for a counter clockwise set of points
 */
// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
export function isCounterClockwise(a: Point, b: Point, c: Point): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

/**
 * For two lines a and b in 2d space, defined by any two points along the lines,
 * find the intersection point, or return null if the lines are parallel
 *
 * @param a1 - First point on line a
 * @param a2 - Second point on line a
 * @param b1 - First point on line b
 * @param b2 - Second point on line b
 *
 * @returns the intersection point of the two lines or null if they are parallel
 */
export function findLineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
    const aDeltaY = a2.y - a1.y;
    const aDeltaX = a2.x - a1.x;
    const bDeltaY = b2.y - b1.y;
    const bDeltaX = b2.x - b1.x;

    const denominator = (bDeltaY * aDeltaX) - (bDeltaX * aDeltaY);

    if (denominator === 0) {
        // Lines are parallel
        return null;
    }

    const originDeltaY = a1.y - b1.y;
    const originDeltaX = a1.x - b1.x;
    const aInterpolation = (bDeltaX * originDeltaY - bDeltaY * originDeltaX) / denominator;

    // Find intersection by projecting out from origin of first segment
    return new Point(a1.x + (aInterpolation * aDeltaX), a1.y + (aInterpolation * aDeltaY));
}

/**
 * Returns the signed area for the polygon ring.  Positive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
 *
 * @param ring - Exterior or interior ring
 */
export function calculateSignedArea(ring: Array<Point>): number {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

/**
 * Detects closed polygons, first + last point are equal
 *
 * @param points - array of points
 * @returns `true` if the points are a closed polygon
 */
export function isClosedPolygon(points: Array<Point>): boolean {
    // If it is 2 points that are the same then it is a point
    // If it is 3 points with start and end the same then it is a line
    if (points.length < 4)
        return false;

    const p1 = points[0];
    const p2 = points[points.length - 1];

    if (Math.abs(p1.x - p2.x) > 0 ||
        Math.abs(p1.y - p2.y) > 0) {
        return false;
    }

    // polygon simplification can produce polygons with zero area and more than 3 points
    return Math.abs(calculateSignedArea(points)) > 0.01;
}

/**
 * Converts spherical coordinates to cartesian coordinates.
 *
 * @param spherical - Spherical coordinates, in [radial, azimuthal, polar]
 * @returns cartesian coordinates in [x, y, z]
 */

export function sphericalToCartesian([r, azimuthal, polar]: [number, number, number]): {
    x: number;
    y: number;
    z: number;
} {
    // We abstract "north"/"up" (compass-wise) to be 0° when really this is 90° (π/2):
    // correct for that here
    azimuthal += 90;

    // Convert azimuthal and polar angles to radians
    azimuthal *= Math.PI / 180;
    polar *= Math.PI / 180;

    return {
        x: r * Math.cos(azimuthal) * Math.sin(polar),
        y: r * Math.sin(azimuthal) * Math.sin(polar),
        z: r * Math.cos(polar)
    };
}

/**
 *  Returns true if the when run in the web-worker context.
 *
 * @returns `true` if the when run in the web-worker context.
 */
export function isWorker(): boolean {
    // @ts-ignore
    return typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
}

/**
 * Parses data from 'Cache-Control' headers.
 *
 * @param cacheControl - Value of 'Cache-Control' header
 * @returns object containing parsed header info.
 */

export function parseCacheControl(cacheControl: string): any {
    // Taken from [Wreck](https://github.com/hapijs/wreck)
    const re = /(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g;

    const header = {};
    cacheControl.replace(re, ($0, $1, $2, $3) => {
        const value = $2 || $3;
        header[$1] = value ? value.toLowerCase() : true;
        return '';
    });

    if (header['max-age']) {
        const maxAge = parseInt(header['max-age'], 10);
        if (isNaN(maxAge)) delete header['max-age'];
        else header['max-age'] = maxAge;
    }

    return header;
}

let _isSafari = null;

/**
 * Returns true when run in WebKit derived browsers.
 * This is used as a workaround for a memory leak in Safari caused by using Transferable objects to
 * transfer data between WebWorkers and the main thread.
 * https://github.com/mapbox/mapbox-gl-js/issues/8771
 *
 * This should be removed once the underlying Safari issue is fixed.
 *
 * @param scope - Since this function is used both on the main thread and WebWorker context,
 *      let the calling scope pass in the global scope object.
 * @returns `true` when run in WebKit derived browsers.
 */
export function isSafari(scope: any): boolean {
    if (_isSafari == null) {
        const userAgent = scope.navigator ? scope.navigator.userAgent : null;
        _isSafari = !!scope.safari ||
        !!(userAgent && (/\b(iPad|iPhone|iPod)\b/.test(userAgent) || (!!userAgent.match('Safari') && !userAgent.match('Chrome'))));
    }
    return _isSafari;
}

export function storageAvailable(type: string): boolean {
    try {
        const storage = window[type];
        storage.setItem('_mapbox_test_', 1);
        storage.removeItem('_mapbox_test_');
        return true;
    } catch (e) {
        return false;
    }
}

// The following methods are from https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_Unicode_Problem
//Unicode compliant base64 encoder for strings
export function b64EncodeUnicode(str: string) {
    return btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            (match, p1) => {
                return String.fromCharCode(Number('0x' + p1)); //eslint-disable-line
            }
        )
    );
}

// Unicode compliant decoder for base64-encoded strings
export function b64DecodeUnicode(str: string) {
    return decodeURIComponent(atob(str).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); //eslint-disable-line
    }).join(''));
}

export function isImageBitmap(image: any): image is ImageBitmap {
    return typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;
}

/**
 * Converts an ArrayBuffer to an ImageBitmap.
 *
 * Used mostly for testing purposes only, because mocking libs don't know how to work with ArrayBuffers, but work
 * perfectly fine with ImageBitmaps. Might also be used for environments (other than testing) not supporting
 * ArrayBuffers.
 *
 * @param data - Data to convert
 * @param callback - A callback executed after the conversion is finished. Invoked with error (if any) as the first argument and resulting image bitmap (when no error) as the second
 */
export function arrayBufferToImageBitmap(data: ArrayBuffer, callback: (err?: Error | null, image?: ImageBitmap | null) => void) {
    const blob: Blob = new Blob([new Uint8Array(data)], {type: 'image/png'});
    createImageBitmap(blob).then((imgBitmap) => {
        callback(null, imgBitmap);
    }).catch((e) => {
        callback(new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`));
    });
}

const transparentPngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

/**
 * Converts an ArrayBuffer to an HTMLImageElement.
 *
 * Used mostly for testing purposes only, because mocking libs don't know how to work with ArrayBuffers, but work
 * perfectly fine with ImageBitmaps. Might also be used for environments (other than testing) not supporting
 * ArrayBuffers.
 *
 * @param data - Data to convert
 * @param callback - A callback executed after the conversion is finished. Invoked with error (if any) as the first argument and resulting image element (when no error) as the second
 */
export function arrayBufferToImage(data: ArrayBuffer, callback: (err?: Error | null, image?: HTMLImageElement | null) => void) {
    const img: HTMLImageElement = new Image();
    img.onload = () => {
        callback(null, img);
        URL.revokeObjectURL(img.src);
        // prevent image dataURI memory leak in Safari;
        // but don't free the image immediately because it might be uploaded in the next frame
        // https://github.com/mapbox/mapbox-gl-js/issues/10226
        img.onload = null;
        window.requestAnimationFrame(() => { img.src = transparentPngUrl; });
    };
    img.onerror = () => callback(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
    const blob: Blob = new Blob([new Uint8Array(data)], {type: 'image/png'});
    img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;
}

/**
 * Computes the webcodecs VideoFrame API options to select a rectangle out of
 * an image and write it into the destination rectangle.
 *
 * Rect (x/y/width/height) select the overlapping rectangle from the source image
 * and layout (offset/stride) write that overlapping rectangle to the correct place
 * in the destination image.
 *
 * Offset is the byte offset in the dest image that the first pixel appears at
 * and stride is the number of bytes to the start of the next row:
 * ┌───────────┐
 * │  dest     │
 * │       ┌───┼───────┐
 * │offset→│▓▓▓│ source│
 * │       │▓▓▓│       │
 * │       └───┼───────┘
 * │stride ⇠╌╌╌│
 * │╌╌╌╌╌╌→    │
 * └───────────┘
 *
 * @param image - source image containing a width and height attribute
 * @param x - top-left x coordinate to read from the image
 * @param y - top-left y coordinate to read from the image
 * @param width - width of the rectangle to read from the image
 * @param height - height of the rectangle to read from the image
 * @returns the layout and rect options to pass into VideoFrame API
 */
function computeVideoFrameParameters(image: Size, x: number, y: number, width: number, height: number): VideoFrameCopyToOptions {
    const destRowOffset = Math.max(-x, 0) * 4;
    const firstSourceRow = Math.max(0, y);
    const firstDestRow = firstSourceRow - y;
    const offset = firstDestRow * width * 4 + destRowOffset;
    const stride = width * 4;

    const sourceLeft = Math.max(0, x);
    const sourceTop = Math.max(0, y);
    const sourceRight = Math.min(image.width, x + width);
    const sourceBottom = Math.min(image.height, y + height);
    return {
        rect: {
            x: sourceLeft,
            y: sourceTop,
            width: sourceRight - sourceLeft,
            height: sourceBottom - sourceTop
        },
        layout: [{offset, stride}]
    };
}

/**
 * Reads pixels from an ImageBitmap/Image/canvas using webcodec VideoFrame API.
 *
 * @param data - image, imagebitmap, or canvas to parse
 * @param x - top-left x coordinate to read from the image
 * @param y - top-left y coordinate to read from the image
 * @param width - width of the rectangle to read from the image
 * @param height - height of the rectangle to read from the image
 * @returns a promise containing the parsed RGBA pixel values of the image, or the error if an error occurred
 */
export async function readImageUsingVideoFrame(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    x: number, y: number, width: number, height: number
): Promise<Uint8ClampedArray> {
    if (typeof VideoFrame === 'undefined') {
        throw new Error('VideoFrame not supported');
    }
    const frame = new VideoFrame(image, {timestamp: 0});
    try {
        const format = frame?.format;
        if (!format || !(format.startsWith('BGR') || format.startsWith('RGB'))) {
            throw new Error(`Unrecognized format ${format}`);
        }
        const swapBR = format.startsWith('BGR');
        const result = new Uint8ClampedArray(width * height * 4);
        await frame.copyTo(result, computeVideoFrameParameters(image, x, y, width, height));
        if (swapBR) {
            for (let i = 0; i < result.length; i += 4) {
                const tmp = result[i];
                result[i] = result[i + 2];
                result[i + 2] = tmp;
            }
        }
        return result;
    } finally {
        frame.close();
    }
}

let offscreenCanvas: OffscreenCanvas;
let offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

/**
 * Reads pixels from an ImageBitmap/Image/canvas using OffscreenCanvas
 *
 * @param data - image, imagebitmap, or canvas to parse
 * @param x - top-left x coordinate to read from the image
 * @param y - top-left y coordinate to read from the image
 * @param width - width of the rectangle to read from the image
 * @param height - height of the rectangle to read from the image
 * @returns a promise containing the parsed RGBA pixel values of the image, or the error if an error occurred
 */
export function readImageDataUsingOffscreenCanvas(
    imgBitmap: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    x: number, y: number, width: number, height: number
): Uint8ClampedArray {
    const origWidth = imgBitmap.width;
    const origHeight = imgBitmap.height;
    // Lazily initialize OffscreenCanvas
    if (!offscreenCanvas || !offscreenCanvasContext) {
        // Dem tiles are typically 256x256
        offscreenCanvas = new OffscreenCanvas(origWidth, origHeight);
        offscreenCanvasContext = offscreenCanvas.getContext('2d', {willReadFrequently: true});
    }

    offscreenCanvas.width = origWidth;
    offscreenCanvas.height = origHeight;

    offscreenCanvasContext.drawImage(imgBitmap, 0, 0, origWidth, origHeight);
    const imgData = offscreenCanvasContext.getImageData(x, y, width, height);
    offscreenCanvasContext.clearRect(0, 0, origWidth, origHeight);
    return imgData.data;
}

/**
 * Reads RGBA pixels from an preferring OffscreenCanvas, but falling back to VideoFrame if supported and
 * the browser is mangling OffscreenCanvas getImageData results.
 *
 * @param data - image, imagebitmap, or canvas to parse
 * @param x - top-left x coordinate to read from the image
 * @param y - top-left y coordinate to read from the image
 * @param width - width of the rectangle to read from the image
 * @param height - height of the rectangle to read from the image
 * @returns a promise containing the parsed RGBA pixel values of the image
 */
export async function getImageData(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    x: number, y: number, width: number, height: number
): Promise<Uint8ClampedArray> {
    if (isOffscreenCanvasDistorted()) {
        try {
            return await readImageUsingVideoFrame(image, x, y, width, height);
        } catch (e) {
            // fall back to OffscreenCanvas
        }
    }
    return readImageDataUsingOffscreenCanvas(image, x, y, width, height);
}
