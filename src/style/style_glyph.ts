import type {AlphaImage} from '../util/image';

/**
 * The glyph's metrices
 * isDoubleResolution = true for 48px textures
 */
export type GlyphMetrics = {
    width: number;
    height: number;
    left: number;
    top: number;
    advance: number;
    isDoubleResolution?: boolean;
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
