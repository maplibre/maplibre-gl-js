import {describe, test, expect} from 'vitest';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {premultipliedDisplayP3, srgbImageToDisplayP3} from './display_p3.ts';
import {RGBAImage} from './image.ts';

describe('premultipliedDisplayP3', () => {
    test('returns a color outside sRGB in Display P3, premultiplied by its alpha', () => {
        const [r, g, b, alpha] = premultipliedDisplayP3(Color.parse('color(display-p3 0 1 0 / 0.5)'));
        expect(r).toBeCloseTo(0, 6);
        expect(g).toBeCloseTo(0.5, 6);
        expect(b).toBeCloseTo(0, 6);
        expect(alpha).toBe(0.5);
    });

    test('returns sRGB green in Display P3', () => {
        const [r, g, b, alpha] = premultipliedDisplayP3(Color.parse('#00ff00'));
        expect(r).toBeCloseTo(0.458402, 5);
        expect(g).toBeCloseTo(0.985265, 5);
        expect(b).toBeCloseTo(0.298295, 5);
        expect(alpha).toBe(1);
    });
});

describe('srgbImageToDisplayP3', () => {
    test('converts each pixel to its Display P3 bytes', () => {
        const srgb = [0, 255, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 255, 128, 0, 255, 17, 200, 99, 255, 3, 4, 5, 255, 250, 251, 252, 255];
        const image = new RGBAImage({width: 7, height: 1}, new Uint8Array(srgb));

        expect(Array.from(srgbImageToDisplayP3(image).data)).toEqual(
            [117, 251, 76, 255, 234, 51, 35, 255, 0, 0, 245, 255, 239, 135, 51, 255, 92, 197, 110, 255, 3, 4, 5, 255, 250, 251, 252, 255]
        );
    });

    test('keeps gray and alpha', () => {
        const image = new RGBAImage({width: 2, height: 1}, new Uint8Array([128, 128, 128, 255, 40, 40, 40, 7]));
        expect(Array.from(srgbImageToDisplayP3(image).data)).toEqual([128, 128, 128, 255, 40, 40, 40, 7]);
    });

    test('leaves the image it converts unchanged', () => {
        const image = new RGBAImage({width: 1, height: 1}, new Uint8Array([0, 255, 0, 255]));
        srgbImageToDisplayP3(image);
        expect(Array.from(image.data)).toEqual([0, 255, 0, 255]);
    });
});
