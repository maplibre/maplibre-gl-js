import type {AlphaImage} from '../util/image';

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
 * @internal
 * A style glyph type
 */
export type StyleGlyph = {
    id: number;
    bitmap: AlphaImage;
    metrics: GlyphMetrics;
};
