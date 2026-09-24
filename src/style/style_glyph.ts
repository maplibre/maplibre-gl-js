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

/** Grapheme clusters requested by font stack and variant, using `default` for standard glyphs. */
export type GlyphRequests = Record<string, Record<string, string[]>>;

/** Glyphs keyed by font stack, variant, and grapheme cluster; `null` means unavailable. */
export type GlyphMap = Record<string, Record<string, Record<string, StyleGlyph | null>>>;
