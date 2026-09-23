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

    const defaultGlyph = atlas.positions.Test.default['\u093E'];
    const alternateGlyph = atlas.positions.Test.alternate['\u093E'];
    const otherFontGlyph = atlas.positions.Other.alternate['\u093E'];
    expect(defaultGlyph.metrics).toEqual(glyphs.Test.default['\u093E'].metrics);
    expect(alternateGlyph.metrics).toEqual(glyphs.Test.alternate['\u093E'].metrics);
    expect(otherFontGlyph.metrics).toEqual(glyphs.Other.alternate['\u093E'].metrics);

    expect(atlas.image.data[(defaultGlyph.rect.y + 1) * atlas.image.width + defaultGlyph.rect.x + 1]).toBe(10);
    expect(atlas.image.data[(alternateGlyph.rect.y + 1) * atlas.image.width + alternateGlyph.rect.x + 1]).toBe(30);
    expect(atlas.image.data[(otherFontGlyph.rect.y + 1) * atlas.image.width + otherFontGlyph.rect.x + 1]).toBe(40);
});
