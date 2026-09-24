import {AlphaImage} from '../util/image.ts';
import {register} from '../util/web_worker_transfer.ts';
import potpack from 'potpack';

import type {GlyphMap, GlyphMetrics} from '../style/style_glyph.ts';

const padding = 1;

/**
 * A rectangle type with position, width and height.
 */
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

/**
 * The glyph's position
 */
export type GlyphPosition = {
    rect: Rect;
    metrics: GlyphMetrics;
};

/**
 * Glyph positions keyed by font stack, variant, and grapheme cluster.
 */
export type GlyphPositions = Record<string, Record<string, Record<string, GlyphPosition>>>;

export class GlyphAtlas {
    image: AlphaImage;
    positions: GlyphPositions;

    constructor(stacks: GlyphMap) {
        const positions: GlyphPositions = {};
        const bins = [];

        for (const stack in stacks) {
            const stackPositions = positions[stack] = {};

            for (const variant in stacks[stack]) {
                const glyphs = stacks[stack][variant];
                stackPositions[variant] = {};
                for (const id in glyphs) {
                    const src = glyphs[id];
                    if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

                    const bin = {
                        x: 0,
                        y: 0,
                        w: src.bitmap.width + 2 * padding,
                        h: src.bitmap.height + 2 * padding
                    };
                    bins.push(bin);
                    stackPositions[variant][id] = {rect: bin, metrics: src.metrics};
                }
            }
        }

        const {w, h} = potpack(bins);
        const image = new AlphaImage({width: w || 1, height: h || 1});

        for (const stack in stacks) {
            for (const variant in stacks[stack]) {
                const glyphs = stacks[stack][variant];
                for (const id in glyphs) {
                    const src = glyphs[id];
                    if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;
                    const bin = positions[stack][variant][id].rect;
                    AlphaImage.copy(src.bitmap, image, {x: 0, y: 0}, {x: bin.x + padding, y: bin.y + padding}, src.bitmap);
                }
            }
        }

        this.image = image;
        this.positions = positions;
    }
}

register('GlyphAtlas', GlyphAtlas);
