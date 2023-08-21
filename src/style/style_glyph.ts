import type {AlphaImage} from '../util/image';

/**
 * The glyph's metrices
 * textureScale = 1 for a texture at 24pt, 2 = 48pt, etc
 */
export type GlyphMetrics = {
    width: number;
    height: number;
    left: number;
    top: number;
    advance: number;
    textureScale: number;
};

/**
 * @internal
 * A style glyph type
 */
export type StyleGlyph = {
    id: number;
    bitmap: AlphaImage;
    metrics: GlyphMetrics;
};
