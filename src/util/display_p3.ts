import {RGBAImage} from './image.ts';

import type {Color} from '@maplibre/maplibre-gl-style-spec';

type ColorImage = {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
};

const linearSrgbToLinearDisplayP3 = [
    0.8224619687143623, 0.17753803128563775, 0,
    0.03319419885096162, 0.9668058011490384, 0,
    0.017082630721120033, 0.07239744066396347, 0.9105199286149165
];

const linearSteps = 16384;

let srgbByteToLinear: Float64Array;
let linearToEncodedByte: Uint8Array;

function encode(linear: number): number {
    return linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function decode(encoded: number): number {
    return encoded <= 0.04045 ? encoded / 12.92 : Math.pow((encoded + 0.055) / 1.055, 2.4);
}

function buildTables(): void {
    srgbByteToLinear = new Float64Array(256);
    for (let i = 0; i < 256; i++) srgbByteToLinear[i] = decode(i / 255);
    linearToEncodedByte = new Uint8Array(linearSteps + 1);
    for (let i = 0; i <= linearSteps; i++) linearToEncodedByte[i] = Math.round(encode(i / linearSteps) * 255);
}

function toEncodedByte(linear: number): number {
    return linearToEncodedByte[Math.round(Math.min(Math.max(linear, 0), 1) * linearSteps)];
}

/**
 * Returns the color's channels in Display P3, premultiplied by its alpha, as the color's own channels are in sRGB.
 */
export function premultipliedDisplayP3(color: Color): [number, number, number, number] {
    const [r, g, b, alpha] = color.displayP3;
    return [r * alpha, g * alpha, b * alpha, alpha];
}

/**
 * Returns a copy of an image whose RGBA bytes are sRGB, not premultiplied, with its colors in Display P3.
 * Every sRGB color is inside Display P3, so nothing is clipped.
 */
export function srgbImageToDisplayP3(image: ColorImage): RGBAImage {
    if (!srgbByteToLinear) buildTables();
    const m = linearSrgbToLinearDisplayP3;
    const {data} = image;
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
        const r = srgbByteToLinear[data[i]];
        const g = srgbByteToLinear[data[i + 1]];
        const b = srgbByteToLinear[data[i + 2]];
        out[i] = toEncodedByte(m[0] * r + m[1] * g + m[2] * b);
        out[i + 1] = toEncodedByte(m[3] * r + m[4] * g + m[5] * b);
        out[i + 2] = toEncodedByte(m[6] * r + m[7] * g + m[8] * b);
        out[i + 3] = data[i + 3];
    }
    return new RGBAImage({width: image.width, height: image.height}, out);
}
