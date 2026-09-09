import type {AlphaImage} from '../util/image.ts';

/**
 * Some metices related to a glyph
 */
export type GlyphMetrics = {
    width: number;
    height: number;
    left: number;
    top: number;
    advance: number;
    /**
     * isDoubleResolution = true for 48px textures
     */
    isDoubleResolution?: boolean;
};

/**
 * A style glyph type
 */
export type StyleGlyph = {
    id: number;
    bitmap: AlphaImage;
    metrics: GlyphMetrics;
};

/** Normal and OpenType vertical glyph data, kept separate from text keys. */
export type GlyphVariants<T> = {
    normal: T;
    vertical: T;
};

/** Glyphs keyed by font stack, variant, and grapheme cluster; `null` means unavailable. */
export type GlyphMap = Record<string, GlyphVariants<Record<string, StyleGlyph | null>>>;

/** Whether the selected font stack provides a usable glyph rendered with `vert` for this grapheme. */
export function hasVerticalForm(glyphMap: GlyphMap, fontStack: string, grapheme: string): boolean {
    return !!glyphMap[fontStack]?.vertical[grapheme];
}
