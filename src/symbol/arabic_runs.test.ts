import {describe, expect, test, vi} from 'vitest';
import {Formatted} from '@maplibre/maplibre-gl-style-spec';
import {Anchor} from './anchor.ts';
import {getGlyphQuads} from './quads.ts';
import {shapeText, WritingMode, type Shaping} from './shaping.ts';
import {transformText} from './transform_text.ts';
import {toGraphemes} from '../util/graphemes.ts';
import {GlyphManager} from '../render/glyph_manager.ts';
import {RequestManager} from '../util/request_manager.ts';
import {createGlyphMap, createSymbolStyleLayer} from '../../test/unit/lib/create_symbol_layer.ts';

import type {GlyphMap} from '../style/style_glyph.ts';

describe('Arabic drawn a word at a time', () => {
    const layer = createSymbolStyleLayer('arabic', 'Test', 'x');
    const kurdishLamAlef = 'ڵ\u200dا';

    /** Lays out a label with one glyph for every cluster the label is made of, as a tile's glyphs are fetched. */
    function layOut(written: string, maxWidth = Infinity): Shaping {
        const label = transformText(Formatted.fromString(written), layer, {} as any);
        const glyph = Object.values(createGlyphMap().Test.default)[0];
        const glyphs = Object.fromEntries(label.sections[0].text.split('\n').flatMap(toGraphemes).map(cluster => [cluster, glyph]));
        const glyphMap = {Test: {default: glyphs}} as unknown as GlyphMap;

        return shapeText(label, glyphMap, glyphMap as any, {}, 'Test', maxWidth, 24, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 24, 24) as Shaping;
    }

    function drawnClusters(shaping: Shaping): string[] {
        return shaping.positionedLines.flatMap(line => line.positionedGlyphs.map(glyph => glyph.grapheme));
    }

    test('lays out Kurdish lam-alef as the one cluster it is written as', () => {
        expect(drawnClusters(layOut('ڵا'))).toEqual([kurdishLamAlef]);
    });

    test('keeps a word whole, however many letters join in it', () => {
        expect(drawnClusters(layOut('ڵاب'))).toEqual(['ڵ\u200dا\u200dب']);
    });

    test('keeps the lines of a bilingual label apart, drawing the Latin line a character at a time', () => {
        const shaping = layOut('HALA\nپارێزگای هەڵەبجە');

        expect(shaping.positionedLines).toHaveLength(2);
        expect(shaping.positionedLines[0].positionedGlyphs.map(glyph => glyph.grapheme)).toEqual(['H', 'A', 'L', 'A']);
        expect(shaping.positionedLines[1].positionedGlyphs.map(glyph => glyph.grapheme)).toEqual([
            'ه\u200dە\u200dڵ\u200dە\u200dب\u200dج\u200dە', ' ', 'پ\u200dا\u200dر\u200dێ\u200dز\u200dگ\u200dا\u200dی'
        ]);
    });

    test('breaks a label between words and never inside one', () => {
        const shaping = layOut('ڵا ڵا', 1);

        expect(shaping.positionedLines.map(line => line.positionedGlyphs.map(glyph => glyph.grapheme))).toEqual([[kurdishLamAlef], [kurdishLamAlef]]);
    });

    test('draws one quad for a word, which is one glyph', () => {
        const quads = getGlyphQuads(new Anchor(0, 0, 0, 0), layOut('ڵا'), [0, 0], layer, false, {} as any, {}, false);

        expect(quads).toHaveLength(1);
        expect(quads[0].tr.x).toBeGreaterThan(quads[0].tl.x);
    });

    test('asks the font to draw Kurdish lam-alef as the two letters it was written as, held together as one glyph', async () => {
        const label = transformText(Formatted.fromString('ڵا'), layer, {} as any);
        const clusters = toGraphemes(label.sections[0].text);
        const drawn: string[] = [];
        const draw = vi.fn((text: string) => {
            drawn.push(text);
            return {data: new Uint8ClampedArray(4), width: 2, height: 2, glyphWidth: 2, glyphHeight: 2, glyphLeft: 0, glyphTop: 2, glyphAdvance: 2};
        });
        const manager = new GlyphManager(new RequestManager(), undefined, undefined, (_options, padding) => ({draw, buffer: padding}));

        const glyphs = await manager.getGlyphs({Test: {default: clusters}});

        expect(clusters).toEqual([kurdishLamAlef]);
        expect(drawn).toEqual(['ڵا']);
        expect(Object.keys(glyphs.Test.default)).toEqual([kurdishLamAlef]);
    });

    test('draws a word the font has a ligature for as the one glyph it is written as', () => {
        const shaping = layOut('لا');

        expect(shaping.text).toBe('ل\u200dا');
        expect(drawnClusters(shaping)).toEqual(['ل\u200dا']);
    });
});
