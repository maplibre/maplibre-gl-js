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

    type ShapeLineLabelOptions = {
        writingMode?: WritingMode.horizontal | WritingMode.vertical;
        allowVerticalPlacement?: boolean;
        missingGlyphs?: string;
    };

    /** Shapes a line label, providing a stub glyph for every character of `text` and its vertical form. */
    function shapeLineLabel(text: string, {writingMode = WritingMode.vertical, allowVerticalPlacement = false, missingGlyphs = ''}: ShapeLineLabelOptions = {}): Shaping | false {
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

    /** Returns each positioned glyph of the shaping as a [character, orientation] pair. */
    function getGlyphOrientations(shaping: Shaping | false): Array<[string, string]> {
        expect(shaping).toBeTruthy();
        return (shaping as Shaping).positionedLines.flatMap(line => line.positionedGlyphs.map(
            (glyph): [string, string] => [String.fromCodePoint(glyph.glyph), glyph.vertical ? 'upright' : 'along-line']));
    }

    test('draws digits between CJK characters upright', () => {
        // The label reported in https://github.com/maplibre/maplibre-gl-js/issues/5404
        expect(getGlyphOrientations(shapeLineLabel('반포대로21길'))).toEqual([
            ['반', 'upright'],
            ['포', 'upright'],
            ['대', 'upright'],
            ['로', 'upright'],
            ['2', 'upright'],
            ['1', 'upright'],
            ['길', 'upright'],
        ]);
    });

    test('draws a trailing digit run upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('身什戰33'))).toEqual([
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
            ['3', 'upright'],
            ['3', 'upright'],
        ]);
    });

    test('draws a digit run upright regardless of its length', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道1234号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['1', 'upright'],
            ['2', 'upright'],
            ['3', 'upright'],
            ['4', 'upright'],
            ['号', 'upright'],
        ]);
    });

    test('draws a whitespace-separated digit upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('身什戰 1'))).toEqual([
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
            [' ', 'along-line'],
            ['1', 'upright'],
        ]);
    });

    test('draws a single uppercase letter between CJK characters upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道A号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['A', 'upright'],
            ['号', 'upright'],
        ]);
    });

    test('rotates a decomposed Latin letter so its combining mark stays attached', () => {
        // é as “e” followed by U+0301 combining acute accent: upright glyphs
        // each advance a full em, which would detach the mark from its base.
        expect(getGlyphOrientations(shapeLineLabel('国道e\u0301号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['e', 'along-line'],
            ['\u0301', 'along-line'],
            ['号', 'upright'],
        ]);
    });

    test('rotates a single lowercase letter mixed with CJK', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道α号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['α', 'along-line'],
            ['号', 'upright'],
        ]);
    });

    test('draws short uppercase codes of non-Latin scripts upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道\u041C1号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['\u041C', 'upright'], // Cyrillic capital М
            ['1', 'upright'],
            ['号', 'upright'],
        ]);
    });

    test('rotates complex-shaping script characters mixed with CJK', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道ب号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['ب', 'along-line'],
            ['号', 'upright'],
        ]);
    });

    test('rotates the prolonged sound mark so it reads as a vertical stroke', () => {
        expect(getGlyphOrientations(shapeLineLabel('札幌タワー'))).toEqual([
            ['札', 'upright'],
            ['幌', 'upright'],
            ['タ', 'upright'],
            ['ワ', 'upright'],
            ['ー', 'along-line'],
        ]);
    });

    test('rotates a wave dash between upright digits', () => {
        expect(getGlyphOrientations(shapeLineLabel('身什戰1〜2'))).toEqual([
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
            ['1', 'upright'],
            ['〜', 'along-line'],
            ['2', 'upright'],
        ]);
    });

    test('rotates lowercase Latin words', () => {
        expect(getGlyphOrientations(shapeLineLabel('two 身什戰'))).toEqual([
            ['t', 'along-line'],
            ['w', 'along-line'],
            ['o', 'along-line'],
            [' ', 'along-line'],
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
        ]);
    });

    test('draws mixed alphanumeric codes upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('身什戰A1'))).toEqual([
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
            ['A', 'upright'],
            ['1', 'upright'],
        ]);
    });

    test('rotates Latin words directly adjoining CJK characters', () => {
        expect(getGlyphOrientations(shapeLineLabel('銀座Ginza通り'))).toEqual([
            ['銀', 'upright'],
            ['座', 'upright'],
            ['G', 'along-line'],
            ['i', 'along-line'],
            ['n', 'along-line'],
            ['z', 'along-line'],
            ['a', 'along-line'],
            ['通', 'upright'],
            ['り', 'upright'],
        ]);
    });

    test('rotates long uppercase words of dual names', () => {
        expect(getGlyphOrientations(shapeLineLabel('ヴィラ ISHIKAWA'))).toEqual([
            ['ヴ', 'upright'],
            ['ィ', 'upright'],
            ['ラ', 'upright'],
            [' ', 'along-line'],
            ['I', 'along-line'],
            ['S', 'along-line'],
            ['H', 'along-line'],
            ['I', 'along-line'],
            ['K', 'along-line'],
            ['A', 'along-line'],
            ['W', 'along-line'],
            ['A', 'along-line'],
        ]);
    });

    test('draws short uppercase codes upright', () => {
        expect(getGlyphOrientations(shapeLineLabel('JR山手線'))).toEqual([
            ['J', 'upright'],
            ['R', 'upright'],
            ['山', 'upright'],
            ['手', 'upright'],
            ['線', 'upright'],
        ]);
    });

    test('replaces a symbol between upright digits with its vertical form', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道1-2号'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['1', 'upright'],
            ['︲', 'upright'], // “-” replaced by U+FE32 presentation form for vertical en dash
            ['2', 'upright'],
            ['号', 'upright'],
        ]);
    });

    test('keeps the horizontal form of symbols in runs that stay rotated', () => {
        expect(getGlyphOrientations(shapeLineLabel('国道3.5km'))).toEqual([
            ['国', 'upright'],
            ['道', 'upright'],
            ['3', 'along-line'],
            ['.', 'along-line'],
            ['5', 'along-line'],
            ['k', 'along-line'],
            ['m', 'along-line'],
        ]);
    });

    test('keeps orientations aligned after a missing glyph', () => {
        // “w” has no glyph, so it produces no positioned glyph; the characters
        // after it must still get their own orientation, not their neighbor's.
        expect(getGlyphOrientations(shapeLineLabel('what 国21号', {missingGlyphs: 'w'}))).toEqual([
            ['h', 'along-line'],
            ['a', 'along-line'],
            ['t', 'along-line'],
            [' ', 'along-line'],
            ['国', 'upright'],
            ['2', 'upright'],
            ['1', 'upright'],
            ['号', 'upright'],
        ]);
    });

    test('does not mark glyphs upright in horizontal writing mode', () => {
        expect(getGlyphOrientations(shapeLineLabel('身什戰33', {writingMode: WritingMode.horizontal}))).toEqual([
            ['身', 'along-line'],
            ['什', 'along-line'],
            ['戰', 'along-line'],
            ['3', 'along-line'],
            ['3', 'along-line'],
        ]);
    });

    test('draws every non-whitespace glyph upright when vertical placement is allowed', () => {
        expect(getGlyphOrientations(shapeLineLabel('two 身什戰', {allowVerticalPlacement: true}))).toEqual([
            ['t', 'upright'],
            ['w', 'upright'],
            ['o', 'upright'],
            [' ', 'along-line'],
            ['身', 'upright'],
            ['什', 'upright'],
            ['戰', 'upright'],
        ]);
    });
});
