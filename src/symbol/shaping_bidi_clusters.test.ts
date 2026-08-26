import {afterEach, describe, expect, test} from 'vitest';
import {Formatted} from '@maplibre/maplibre-gl-style-spec';
import {shapeText, WritingMode, type Shaping} from './shaping.ts';
import {rtlWorkerPlugin} from '../source/rtl_text_plugin_worker.ts';
import {toGraphemes} from '../util/graphemes.ts';
import type {StyleGlyph} from '../style/style_glyph.ts';

/**
 * What a right-to-left text plugin does to a line: it reverses it.
 *
 * That is the whole of what matters here. Reversing a letter and the marks written on it leaves the
 * marks *before* the letter, and directly after the letter that came before it -- so unless they
 * are put back, a letter and its marks are no longer one grapheme cluster, and the tile has asked
 * for a glyph for a cluster that layout will never look up.
 */
function stubReversingPlugin() {
    rtlWorkerPlugin.processBidirectionalText = (text: string, lineBreaks: number[]) => {
        const lines: string[] = [];
        let start = 0;
        for (const at of [...lineBreaks, text.length]) {
            if (at > start) lines.push([...text.slice(start, at)].reverse().join(''));
            start = at;
        }
        return lines;
    };
    rtlWorkerPlugin.processStyledBidirectionalText = null;
}

afterEach(() => {
    rtlWorkerPlugin.processBidirectionalText = null;
    rtlWorkerPlugin.processStyledBidirectionalText = null;
});

const metrics = {width: 10, height: 10, left: 0, top: -8, advance: 10};

/** A glyph for every grapheme cluster of `text`, and for every codepoint, as a tile asks for. */
function glyphsFor(text: string): Record<string, Record<string, StyleGlyph>> {
    const glyphs: Record<string, StyleGlyph> = {};
    for (const grapheme of toGraphemes(text)) {
        glyphs[grapheme] = {id: grapheme.codePointAt(0), metrics} as StyleGlyph;
        for (const char of grapheme) {
            glyphs[char] = {id: char.codePointAt(0), metrics} as StyleGlyph;
        }
    }
    return {Test: glyphs};
}

function shape(text: string, glyphs = glyphsFor(text)): Shaping | false {
    return shapeText(
        Formatted.fromString(text), glyphs, {}, {}, 'Test',
        Infinity, 24, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 24, 24,
    );
}

/** The grapheme cluster each positioned glyph draws, in the order they are drawn. */
function drawn(shaping: Shaping | false): string[] {
    expect(shaping).toBeTruthy();
    return (shaping as Shaping).positionedLines.flatMap(
        line => line.positionedGlyphs.map(glyph => glyph.grapheme));
}

describe('a right-to-left line whose letters carry marks', () => {
    // שְׁדֵרוֹת -- three of its letters are written
    // with vowel points, and one of those carries two of them.
    const SHIN_SHEVA_DOT = 'שְׁ';
    const DALET_TSERE = 'דֵ';
    const RESH = 'ר';
    const VAV_HOLAM = 'וֹ';
    const TAV = 'ת';
    const text = SHIN_SHEVA_DOT + DALET_TSERE + RESH + VAV_HOLAM + TAV;

    test('keeps each letter with the marks written on it', () => {
        stubReversingPlugin();

        // Read right to left, so the letters come out in the reverse of the order they were
        // written -- but each letter still carries its own marks, in the order they were written.
        expect(drawn(shape(text))).toEqual([TAV, VAV_HOLAM, RESH, DALET_TSERE, SHIN_SHEVA_DOT]);
    });

    test('draws only clusters the tile asked for a glyph for', () => {
        stubReversingPlugin();

        const requested = new Set(Object.keys(glyphsFor(text).Test));
        for (const grapheme of drawn(shape(text))) {
            expect(requested).toContain(grapheme);
        }
    });

    test('falls back to one codepoint at a time when no glyph covers the cluster', () => {
        stubReversingPlugin();

        // Only the individual codepoints have glyphs, as when a style declares no font file for
        // this script.
        const codepointsOnly: Record<string, StyleGlyph> = {};
        for (const char of text) {
            codepointsOnly[char] = {id: char.codePointAt(0), metrics} as StyleGlyph;
        }

        const asClusters = drawn(shape(text)).join('');
        const asCodepoints = drawn(shape(text, {Test: codepointsOnly}));

        // The same codepoints in the same order -- just as separate glyphs, with the marks no
        // longer positioned on their letters. This is what MapLibre has always drawn.
        expect(asCodepoints.join('')).toBe(asClusters);
        expect(asCodepoints).toHaveLength([...text].length);
    });

    test('leaves a left-to-right letter and its mark as one cluster', () => {
        // No plugin here: a left-to-right line is never reversed, so its marks already follow their
        // base and rule L3 must not move them. `e` with a combining acute accent.
        expect(drawn(shape('é'))).toEqual(['é']);
    });
});
