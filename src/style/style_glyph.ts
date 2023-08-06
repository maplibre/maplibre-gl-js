import type {AlphaImage} from '../util/image';

/**
 * The glyph's metrices
 */
export type GlyphMetrics = {
    width: number;
    height: number;
    left: number;
    top: number;
    advance: number;
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
