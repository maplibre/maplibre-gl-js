import {describe, test, expect} from 'vitest';
import {type PositionedIcon, type Box, type Shaping, applyTextFit, shapeIcon, fitIconToText, shapeText, WritingMode} from './shaping.ts';
import {ImagePosition} from '../render/image_atlas.ts';
import {type StyleImage, TextFit} from '../style/style_image.ts';
import {Formatted} from '@maplibre/maplibre-gl-style-spec';
import {verticalizedCharacterMap} from '../util/verticalize_punctuation.ts';
import type {StyleGlyph} from '../style/style_glyph.ts';

describe('applyTextFit', () => {

    describe('applyTextFitHorizontal', () => {
        // This set of tests against applyTextFit starts with a 100x20 image with a 5,5,95,15 content box
        // that has been scaled to 4x4... resulting in a 14x14 image.
        const left = 0;
        const top = 0;
        const right = 14;
        const bottom = 14;
        const rectangle = {x: 0, y: 0, w: 100, h: 20};
        const content: [number, number, number, number] = [5, 5, 95, 15];

        test('applyTextFit: not specified', async () => {
            // No change should happen
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 14});
        });

        test('applyTextFit: stretchOrShrink', async () => {
            // No change should happen
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.stretchOrShrink,
                textFitHeight: TextFit.stretchOrShrink,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 14});
        });

        test('applyTextFit: stretchOnly, proportional', async () => {
            // Since textFitWidth is stretchOnly, it should be returned to
            // the aspect ratio of the content rectangle (9:1) aspect ratio so 126x14.
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.stretchOnly,
                textFitHeight: TextFit.proportional,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 126, y2: 14});
        });
    });

    describe('applyTextFitVertical', () => {
        // This set of tests against applyTextFit starts with a 20x100 image with a 5,5,15,95 content box
        // that has been scaled to 4x4... resulting in a 14x14 image.
        const left = 0;
        const top = 0;
        const right = 14;
        const bottom = 14;
        const rectangle = {x: 0, y: 0, w: 20, h: 100};
        const content: [number, number, number, number] = [5, 5, 15, 95];

        test('applyTextFit: proportional, stretchOnly', async () => {
            // Since the rectangle is wider than tall, when it matches based on width (because that is proportional),
            // then the height will stretch to match the content so we also get a 14x14 image.
            const styleImage: StyleImage = {
                pixelRatio: 1,
                version: 1,
                sdf: false,
                content,
                textFitWidth: TextFit.proportional,
                textFitHeight: TextFit.stretchOnly,
                data: undefined!};
            const shapedIcon: PositionedIcon = {
                left,
                top,
                right,
                bottom,
                image: new ImagePosition(rectangle, styleImage),
            };
            const result: Box = applyTextFit(shapedIcon);
            expect(result).toEqual({x1: 0, y1: 0, x2: 14, y2: 126});
        });
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
        version: 1,
        needsFirstWebGLRender: false
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

describe('shapeText vertical glyph orientation', () => {
    const fontStack = 'Test';

    function shape(text: string, writingMode: WritingMode.horizontal | WritingMode.vertical, allowVerticalPlacement: boolean = false, missingGlyphs: string = ''): Shaping | false {
        const glyphs: {[_: number]: StyleGlyph} = {};
        const addGlyph = (codePoint: number) => {
            glyphs[codePoint] = {
                id: codePoint,
                bitmap: null,
                metrics: {width: 10, height: 18, left: 1, top: -8, advance: 12}
            };
        };
        for (const char of text) {
            if (missingGlyphs.includes(char)) continue;
            addGlyph(char.codePointAt(0));
            const verticalizedChar = verticalizedCharacterMap[char];
            if (verticalizedChar) addGlyph(verticalizedChar.codePointAt(0));
        }
        return shapeText(Formatted.fromString(text), {[fontStack]: glyphs}, {}, {}, fontStack, Infinity, 24, 'center', 'center', 0, [0, 0], writingMode, allowVerticalPlacement, 24, 24);
    }

    function verticalFlags(shaping: Shaping | false): boolean[] {
        expect(shaping).toBeTruthy();
        return (shaping as Shaping).positionedLines.flatMap(line => line.positionedGlyphs.map(glyph => glyph.vertical));
    }

    test('keeps digits between CJK characters upright in vertical line labels', () => {
        // “반포대로21길” from https://github.com/maplibre/maplibre-gl-js/issues/5404
        expect(verticalFlags(shape('반포대로21길', WritingMode.vertical)))
            .toEqual([true, true, true, true, true, true, true]);
    });

    test('keeps a trailing digit run upright in vertical line labels', () => {
        expect(verticalFlags(shape('身什戰33', WritingMode.vertical)))
            .toEqual([true, true, true, true, true]);
    });

    test('keeps a long digit run adjoining CJK upright in vertical line labels', () => {
        expect(verticalFlags(shape('国道1234号', WritingMode.vertical)))
            .toEqual([true, true, true, true, true, true, true]);
    });

    test('keeps a whitespace-separated digit upright in vertical line labels', () => {
        expect(verticalFlags(shape('身什戰 1', WritingMode.vertical)))
            .toEqual([true, true, true, false, true]);
    });

    test('keeps a single Latin letter between CJK characters upright in vertical line labels', () => {
        expect(verticalFlags(shape('国道A号', WritingMode.vertical)))
            .toEqual([true, true, true, true]);
    });

    test('rotates a decomposed Latin letter so its combining mark stays attached', () => {
        // é as “e” followed by U+0301 combining acute accent: upright glyphs
        // each advance a full em, which would detach the mark from its base.
        expect(verticalFlags(shape('国道é号', WritingMode.vertical)))
            .toEqual([true, true, false, false, true]);
    });

    test('rotates single non-Latin letters mixed with CJK', () => {
        expect(verticalFlags(shape('国道α号', WritingMode.vertical)))
            .toEqual([true, true, false, true]);
    });

    test('rotates complex-shaping script characters mixed with CJK', () => {
        expect(verticalFlags(shape('国道ب号', WritingMode.vertical)))
            .toEqual([true, true, false, true]);
    });

    test('rotates the prolonged sound mark so it reads as a vertical stroke', () => {
        expect(verticalFlags(shape('札幌タワー', WritingMode.vertical)))
            .toEqual([true, true, true, true, false]);
    });

    test('rotates a wave dash between upright digits', () => {
        expect(verticalFlags(shape('身什戰1〜2', WritingMode.vertical)))
            .toEqual([true, true, true, true, false, true]);
    });

    test('rotates lowercase Latin words in vertical line labels', () => {
        expect(verticalFlags(shape('two 身什戰', WritingMode.vertical)))
            .toEqual([false, false, false, false, true, true, true]);
    });

    test('keeps mixed alphanumeric runs upright in vertical line labels', () => {
        expect(verticalFlags(shape('身什戰A1', WritingMode.vertical)))
            .toEqual([true, true, true, true, true]);
    });

    test('rotates Latin words directly adjoining CJK characters', () => {
        expect(verticalFlags(shape('銀座Ginza通り', WritingMode.vertical)))
            .toEqual([true, true, false, false, false, false, false, true, true]);
    });

    test('rotates long uppercase words of dual names', () => {
        expect(verticalFlags(shape('ヴィラ ISHIKAWA', WritingMode.vertical)))
            .toEqual([true, true, true, false, false, false, false, false, false, false, false, false]);
    });

    test('keeps short uppercase codes upright', () => {
        expect(verticalFlags(shape('JR山手線', WritingMode.vertical)))
            .toEqual([true, true, true, true, true]);
    });

    test('replaces symbols between upright digits with their vertical forms', () => {
        const shaping = shape('国道1-2号', WritingMode.vertical) as Shaping;
        expect(shaping.positionedLines[0].positionedGlyphs.map(glyph => glyph.vertical))
            .toEqual([true, true, true, true, true, true]);
        // “-” becomes “︲” (U+FE32 presentation form for vertical en dash)
        expect(shaping.positionedLines[0].positionedGlyphs[3].glyph).toBe(0xFE32);
    });

    test('rotates symbols of runs that stay horizontal', () => {
        const shaping = shape('国道3.5km', WritingMode.vertical) as Shaping;
        expect(shaping.positionedLines[0].positionedGlyphs.map(glyph => glyph.vertical))
            .toEqual([true, true, false, false, false, false, false]);
        // “.” keeps its horizontal form inside the rotated run
        expect(shaping.positionedLines[0].positionedGlyphs[3].glyph).toBe('.'.codePointAt(0));
    });

    test('keeps orientations aligned after a missing glyph', () => {
        // “w” has no glyph, so it produces no positioned glyph; the characters
        // after it must still get their own orientation, not their neighbor’s.
        expect(verticalFlags(shape('what 国21号', WritingMode.vertical, false, 'w')))
            .toEqual([false, false, false, false, true, true, true, true]);
    });

    test('does not verticalize glyphs in horizontal writing mode', () => {
        expect(verticalFlags(shape('身什戰33', WritingMode.horizontal)))
            .toEqual([false, false, false, false, false]);
    });

    test('verticalizes all non-whitespace glyphs when vertical placement is allowed', () => {
        expect(verticalFlags(shape('two 身什戰', WritingMode.vertical, true)))
            .toEqual([true, true, true, false, true, true, true]);
    });
});
