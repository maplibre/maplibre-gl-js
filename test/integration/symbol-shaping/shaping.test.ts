import fs from 'fs';
import path from 'path';
import {WritingMode, shapeText, Shaping} from '../../../src/symbol/shaping';
import {ResolvedImage, Formatted, FormattedSection} from '@maplibre/maplibre-gl-style-spec';
import {ImagePosition} from '../../../src/render/image_atlas';
import type {StyleImage} from '../../../src/style/style_image';
import type {StyleGlyph} from '../../../src/style/style_glyph';

import glyphsJson from '../assets/glyphs/fontstack-glyphs.json' with {type: 'json'};
import expectedJson from './tests/text-shaping-linebreak.json' with {type: 'json'};
import expectedImagesHorizontal from './tests/text-shaping-images-horizontal.json' with {type: 'json'};
import expectedNewLine from './tests/text-shaping-newline.json' with {type: 'json'};
import expectedNewLinesInMiddle from './tests/text-shaping-newlines-in-middle.json' with {type: 'json'};

// Prefer zero width spaces when breaking lines. Zero width spaces are used by MapLibre data sources as a hint that
// a position is ideal for breaking.
import expectedZeroWidthSpaceBreak from './tests/text-shaping-zero-width-space.json' with {type: 'json'};

let UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    UPDATE = !!process.env.UPDATE;
}

describe('shaping', () => {
    const oneEm = 24;
    const layoutTextSize = 16;
    const layoutTextSizeThisZoom = 16;
    const fontStack = 'Test';
    const glyphs = {
        'Test': glyphsJson as any as StyleGlyph
    };
    const glyphPositions = glyphs;

    const images = {
        'square': new ImagePosition({x: 0, y: 0, w: 16, h: 16}, {pixelRatio: 1, version: 1} as StyleImage),
        'tall': new ImagePosition({x: 0, y: 0, w: 16, h: 32}, {pixelRatio: 1, version: 1} as StyleImage),
        'wide': new ImagePosition({x: 0, y: 0, w: 32, h: 16}, {pixelRatio: 1, version: 1} as StyleImage),
    };

    const sectionForImage = (name) => {
        return new FormattedSection('', ResolvedImage.fromString(name), null, null, null);
    };

    const sectionForText = (name, scale?) => {
        return new FormattedSection(name, null, scale, null, null);
    };

    let shaped = shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-null.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-null.json')
    );

    // Default shaping.
    shaped = shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-default.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-default.json')
    );

    // Letter spacing.
    shaped = shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-spacing.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-spacing.json')
    );

    // Line break.
    shaped = shapeText(Formatted.fromString('abcde abcde'), glyphs, glyphPositions, images, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-linebreak.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedJson);

    shaped = shapeText(Formatted.fromString('abcde\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-newline.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedNewLine);

    shaped = shapeText(Formatted.fromString('abcde\r\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom) as Shaping;
    expect(shaped.positionedLines).toEqual(expectedNewLine.positionedLines);

    shaped = shapeText(Formatted.fromString('abcde\n\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-newlines-in-middle.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedNewLinesInMiddle);

    shaped = shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-zero-width-space.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedZeroWidthSpaceBreak);

    // Null shaping.
    shaped = shapeText(Formatted.fromString(''), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    expect(false).toBe(shaped);

    shaped = shapeText(Formatted.fromString(String.fromCharCode(0)), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
    expect(false).toBe(shaped);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shaped = shapeText(Formatted.fromString('   foo bar\n'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom) as Shaping;
    const shaped2 = shapeText(Formatted.fromString('foo bar'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom) as Shaping;
    expect(shaped.positionedLines).toEqual(shaped2.positionedLines);

    test('basic image shaping', () => {
        const shaped = shapeText(new Formatted([sectionForImage('square')]), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom) as Shaping;
        expect(shaped.top).toBe(-12);    // 1em line height
        expect(shaped.left).toBe(-10.5); // 16 - 2px border * 1.5 scale factor

    });

    test('images in horizontal layout', () => {
        const horizontalFormatted = new Formatted([
            sectionForText('Foo'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\n'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText(' bar'),
        ]);
        const shaped = shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-images-horizontal.json'), JSON.stringify(shaped, null, 2));
        expect(shaped).toEqual(expectedImagesHorizontal);

    });

    test('images in vertical layout', () => {
        const expectedImagesVertical = require('./tests/text-shaping-images-vertical.json');
        const horizontalFormatted = new Formatted([
            sectionForText('三'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\u200b'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText('三'),
        ]);
        const shaped = shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.vertical, true, layoutTextSize, layoutTextSizeThisZoom);
        if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-images-vertical.json'), JSON.stringify(shaped, null, 2));
        expect(shaped).toEqual(expectedImagesVertical);
    });
});
