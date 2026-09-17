import {expect, test} from 'vitest';
import {GlyphAtlas} from './glyph_atlas.ts';
import {AlphaImage} from '../util/image.ts';

import type {GlyphMap, StyleGlyph} from '../style/style_glyph.ts';

function createGlyph(value: number): StyleGlyph {
    return {
        id: 0x093E,
        bitmap: new AlphaImage({width: 1, height: 1}, new Uint8Array([value])),
        metrics: {width: 1, height: 1, left: 0, top: 0, advance: value}
    };
}

test('packs glyphs separately by font, variant, and unmodified text', () => {
    const glyphs: GlyphMap = {
        Test: {
            default: {'\u093E': createGlyph(10), '\0\u093E': createGlyph(20)},
            alternate: {
                '\u093E': createGlyph(30),
                missing: null,
                empty: {...createGlyph(0), bitmap: new AlphaImage({width: 0, height: 0})}
            }
        },
        Other: {alternate: {'\u093E': createGlyph(40)}, empty: {}}
    };

    const atlas = new GlyphAtlas(glyphs);

    expect(Object.keys(atlas.positions.Test.default)).toEqual(['\u093E', '\0\u093E']);
    expect(Object.keys(atlas.positions.Test.alternate)).toEqual(['\u093E']);
    expect(Object.keys(atlas.positions.Other)).toEqual(['alternate', 'empty']);
    expect(atlas.positions.Other.empty).toEqual({});
    const pixels = new Set<number>();
    for (const stack of Object.keys(atlas.positions)) {
        for (const variant of Object.keys(atlas.positions[stack])) {
            for (const [text, {rect, metrics}] of Object.entries(atlas.positions[stack][variant])) {
                const pixel = (rect.y + 1) * atlas.image.width + rect.x + 1;
                pixels.add(pixel);
                expect(atlas.image.data[pixel]).toBe(glyphs[stack][variant][text].bitmap.data[0]);
                expect(metrics).toEqual(glyphs[stack][variant][text].metrics);
            }
        }
    }
    expect(pixels.size).toBe(4);
});
