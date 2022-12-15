import fs from 'fs';
import path from 'path';
import {WritingMode, shapeIcon, shapeText, fitIconToText, PositionedIcon, Shaping} from '../../../src/symbol/shaping';
import Formatted, {FormattedSection} from '../../../src/style-spec/expression/types/formatted';
import ResolvedImage from '../../../src/style-spec/expression/types/resolved_image';
import expectedJson from './tests/text-shaping-linebreak.json' assert {type: 'json'};
import {ImagePosition} from '../../../src/render/image_atlas';
import {StyleImage} from '../../../src/style/style_image';

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
        'Test': require('../assets/glyphs/fontstack-glyphs.json')
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

    let shaped;

    JSON.parse('{}');

    shaped = shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-null.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-null.json')
    );

    // Default shaping.
    shaped = shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-default.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-default.json')
    );

    // Letter spacing.
    shaped = shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-spacing.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(
        require('./tests/text-shaping-spacing.json')
    );

    // Line break.
    shaped = shapeText(Formatted.fromString('abcde abcde'), glyphs, glyphPositions, images, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-linebreak.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedJson);

    const expectedNewLine = require('./tests/text-shaping-newline.json');

    shaped = shapeText(Formatted.fromString('abcde\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-newline.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedNewLine);

    shaped = shapeText(Formatted.fromString('abcde\r\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    expect(shaped.positionedLines).toEqual(expectedNewLine.positionedLines);

    const expectedNewLinesInMiddle = require('./tests/text-shaping-newlines-in-middle.json');

    shaped = shapeText(Formatted.fromString('abcde\n\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-newlines-in-middle.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedNewLinesInMiddle);

    // Prefer zero width spaces when breaking lines. Zero width spaces are used by MapLibre data sources as a hint that
    // a position is ideal for breaking.
    const expectedZeroWidthSpaceBreak = require('./tests/text-shaping-zero-width-space.json');

    shaped = shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-zero-width-space.json'), JSON.stringify(shaped, null, 2));
    expect(shaped).toEqual(expectedZeroWidthSpaceBreak);

    // Null shaping.
    shaped = shapeText(Formatted.fromString(''), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    expect(false).toBe(shaped);

    shaped = shapeText(Formatted.fromString(String.fromCharCode(0)), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    expect(false).toBe(shaped);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shaped = shapeText(Formatted.fromString('   foo bar\n'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    const shaped2 = shapeText(Formatted.fromString('foo bar'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom) as Shaping;
    expect(shaped.positionedLines).toEqual(shaped2.positionedLines);

    test('basic image shaping', () => {
        const shaped = shapeText(new Formatted([sectionForImage('square')]), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom) as Shaping;
        expect(shaped.top).toBe(-12);    // 1em line height
        expect(shaped.left).toBe(-10.5); // 16 - 2px border * 1.5 scale factor

    });

    test('images in horizontal layout', () => {
        const expectedImagesHorizontal = require('./tests/text-shaping-images-horizontal.json');
        const horizontalFormatted = new Formatted([
            sectionForText('Foo'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\n'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText(' bar'),
        ]);
        const shaped = shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
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
        const shaped = shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.vertical, true, 'point', layoutTextSize, layoutTextSizeThisZoom);
        if (UPDATE) fs.writeFileSync(path.resolve(__dirname, './tests/text-shaping-images-vertical.json'), JSON.stringify(shaped, null, 2));
        expect(shaped).toEqual(expectedImagesVertical);

    });

});

describe('shapeIcon', () => {
    const imagePosition = new ImagePosition({x: 0, y: 0, w: 22, h: 22}, {pixelRatio: 1, version: 1} as StyleImage);
    const image = Object.freeze({
        content: undefined,
        stretchX: undefined,
        stretchY: undefined,
        paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22}),
        pixelRatio: 1,
        version: 1
    });

    test('text-anchor: center', () => {
        expect(shapeIcon(imagePosition, [0, 0], 'center')).toEqual({
            top: -10,
            bottom: 10,
            left: -10,
            right: 10,
            image
        });

        expect(shapeIcon(imagePosition, [4, 7], 'center')).toEqual({
            top: -3,
            bottom: 17,
            left: -6,
            right: 14,
            image
        });

    });

    test('text-anchor: left', () => {
        expect(shapeIcon(imagePosition, [0, 0], 'left')).toEqual({
            top: -10,
            bottom: 10,
            left: 0,
            right: 20,
            image
        });

        expect(shapeIcon(imagePosition, [4, 7], 'left')).toEqual({
            top: -3,
            bottom: 17,
            left: 4,
            right: 24,
            image
        });

    });

    test('text-anchor: bottom-right', () => {
        expect(shapeIcon(imagePosition, [0, 0], 'bottom-right')).toEqual({
            top: -20,
            bottom: 0,
            left: -20,
            right: 0,
            image
        });

        expect(shapeIcon(imagePosition, [4, 7], 'bottom-right')).toEqual({
            top: -13,
            bottom: 7,
            left: -16,
            right: 4,
            image
        });

    });

});

describe('fitIconToText', () => {
    const glyphSize = 24;
    const shapedIcon = Object.freeze({
        top: -10,
        bottom: 10,
        left: -10,
        right: 10,
        collisionPadding: undefined,
        image: Object.freeze({
            pixelRatio: 1,
            displaySize: [20, 20],
            paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22})
        })
    }) as PositionedIcon;

    const shapedText = Object.freeze({
        top: -10,
        bottom: 30,
        left: -60,
        right: 20
    }) as Shaping;

    test('icon-text-fit: width', () => {
        expect(
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: 0,
            right: 20,
            bottom: 20,
            left: -60
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: 7,
            right: 23,
            bottom: 27,
            left: -57
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        });

        // Ignores padding for top/bottom, since the icon is only stretched to the text's width but not height
        expect(
            fitIconToText(shapedIcon, shapedText, 'width', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -5,
            right: 20,
            bottom: 15,
            left: -40
        });

    });

    test('icon-text-fit: height', () => {
        expect(
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -10,
            right: -10,
            bottom: 30,
            left: -30
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -3,
            right: -7,
            bottom: 37,
            left: -27
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -5,
            right: 0,
            bottom: 15,
            left: -20
        });

        // Ignores padding for left/right, since the icon is only stretched to the text's height but not width
        expect(
            fitIconToText(shapedIcon, shapedText, 'height', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -10,
            right: 0,
            bottom: 20,
            left: -20
        });

    });

    test('icon-text-fit: both', () => {
        expect(
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -10,
            right: 20,
            bottom: 30,
            left: -60
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -3,
            right: 23,
            bottom: 37,
            left: -57
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'both', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -10,
            right: 20,
            bottom: 20,
            left: -40
        });

        expect(
            fitIconToText(shapedIcon, shapedText, 'both', [0, 5, 10, 15], [0, 0], 12 / glyphSize)
        ).toEqual({
            image: shapedIcon.image,
            collisionPadding: undefined,
            top: -5,
            right: 15,
            bottom: 25,
            left: -45
        });

    });

});
