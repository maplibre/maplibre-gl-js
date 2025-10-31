import {loadGlyphRange} from '../style/load_glyph_range';

import TinySDF from '@mapbox/tiny-sdf';
import {unicodeBlockLookup} from '../util/is_char_in_unicode_block';
import {AlphaImage} from '../util/image';
import {warnOnce} from '../util/util';

import type {StyleGlyph} from '../style/style_glyph';
import type {RequestManager} from '../util/request_manager';
import type {GetGlyphsResponse} from '../util/actor_messages';

import {v8} from '@maplibre/maplibre-gl-style-spec';

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: {
        [id: number]: StyleGlyph | null;
    };
    requests: {
        [range: number]: Promise<{[_: number]: StyleGlyph | null}>;
    };
    ranges: {
        [range: number]: boolean | null;
    };
    tinySDF?: TinySDF;
    ideographTinySDF?: TinySDF;
};

/**
 * The style specification hard-codes some last resort fonts as a default fontstack.
 */
const defaultStack = v8.layout_symbol['text-font'].default.join(',');
/**
 * The CSS generic font family closest to `defaultStack`.
 */
const defaultGenericFontFamily = 'sans-serif';

/**
 * Scale factor for client-generated glyphs.
 *
 * Client-generated glyphs are rendered at 2× because CJK glyphs are more detailed than others.
 */
const textureScale = 2;

export class GlyphManager {
    requestManager: RequestManager;
    localIdeographFontFamily: string | false;
    entries: {[stack: string]: Entry};
    url: string;
    lang?: string;

    // exposed as statics to enable stubbing in unit tests
    static loadGlyphRange = loadGlyphRange;
    static TinySDF = TinySDF;

    constructor(requestManager: RequestManager, localIdeographFontFamily?: string | false, lang?: string) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
        this.lang = lang;
    }

    setURL(url?: string | null) {
        this.url = url;
    }

    async getGlyphs(glyphs: {[stack: string]: Array<number>}): Promise<GetGlyphsResponse> {
        const glyphsPromises: Promise<{stack: string; id: number; glyph: StyleGlyph}>[] = [];

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                glyphsPromises.push(this._getAndCacheGlyphsPromise(stack, id));
            }
        }

        const updatedGlyphs = await Promise.all(glyphsPromises);

        const result: GetGlyphsResponse = {};

        for (const {stack, id, glyph} of updatedGlyphs) {
            if (!result[stack]) {
                result[stack] = {};
            }
            // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
            result[stack][id] = glyph && {
                id: glyph.id,
                bitmap: glyph.bitmap.clone(),
                metrics: glyph.metrics
            };
        }

        return result;
    }

    async _getAndCacheGlyphsPromise(stack: string, id: number): Promise<{stack: string; id: number; glyph: StyleGlyph}> {
        // Create an entry for this fontstack if it doesn’t already exist.
        let entry = this.entries[stack];
        if (!entry) {
            entry = this.entries[stack] = {
                glyphs: {},
                requests: {},
                ranges: {}
            };
        }

        // Try to get the glyph from the cache of client-side glyphs by codepoint.
        let glyph = entry.glyphs[id];
        if (glyph !== undefined) {
            return {stack, id, glyph};
        }

        // If the style hasn’t opted into server-side fonts or this codepoint is CJK, draw the glyph locally and cache it.
        if (!this.url || this._charUsesLocalIdeographFontFamily(id)) {
            glyph = entry.glyphs[id] = this._drawGlyph(entry, stack, id);
            return {stack, id, glyph};
        }

        return await this._downloadAndCacheRangePromise(stack, id);
    }

    async _downloadAndCacheRangePromise(stack: string, id: number): Promise<{stack: string; id: number; glyph: StyleGlyph}> {
        // Avoid requesting astral codepoints from the server because we can’t handle them anyways.
        // https://github.com/maplibre/maplibre-gl-js/issues/2307
        const range = Math.floor(id / 256);
        if (range * 256 > 65535) {
            throw new Error('glyphs > 65535 not supported');
        }

        // Try to get the glyph from the cache of server-side glyphs by PBF range.
        const entry = this.entries[stack];
        if (entry.ranges[range]) {
            return {stack, id, glyph: null};
        }

        // Start downloading this range unless we’re currently downloading it.
        if (!entry.requests[range]) {
            const promise = GlyphManager.loadGlyphRange(stack, range, this.url, this.requestManager);
            entry.requests[range] = promise;
        }

        try {
            // Get the response and cache the glyphs from it.
            const response = await entry.requests[range];
            for (const id in response) {
                entry.glyphs[+id] = response[+id];
            }
            entry.ranges[range] = true;
            return {stack, id, glyph: response[id] || null};
        } catch (e) {
            // Fall back to drawing the glyph locally and caching it.
            const glyph = entry.glyphs[id] = this._drawGlyph(entry, stack, id);
            this._warnOnMissingGlyphRange(glyph, range, id, e);
            return {stack, id, glyph};
        }
    }

    _warnOnMissingGlyphRange(glyph: StyleGlyph, range: number, id: number, err: Error) {
        const begin = range * 256;
        const end = begin + 255;
        const codePoint = id.toString(16).padStart(4, '0').toUpperCase();
        warnOnce(`Unable to load glyph range ${range}, ${begin}-${end}. Rendering codepoint U+${codePoint} locally instead. ${err}`);
    }

    _charUsesLocalIdeographFontFamily(id: number): boolean {
        // The CJK Unified Ideographs blocks and Hangul Syllables blocks are
        // spread across many glyph PBFs and are typically accessed very
        // randomly. Preferring local rendering for these blocks reduces
        // wasteful bandwidth consumption. For visual consistency within CJKV
        // text, also include any other CJKV or siniform ideograph or hangul,
        // hiragana, or katakana character.
        return !!this.localIdeographFontFamily &&
        (/\p{Ideo}|\p{sc=Hang}|\p{sc=Hira}|\p{sc=Kana}/u.test(String.fromCodePoint(id)) ||
        // fallback: RegExp can't cover all cases. refer Issue #5420
        unicodeBlockLookup['CJK Unified Ideographs'](id) ||
        unicodeBlockLookup['Hangul Syllables'](id) ||
        unicodeBlockLookup['Hiragana'](id) ||
        unicodeBlockLookup['Katakana'](id) || // includes "ー"
        // memo: these symbols are not all. others could be added if needed.
        unicodeBlockLookup['CJK Symbols and Punctuation'](id) || // 、。〃〄々〆〇〈〉《》「...
        unicodeBlockLookup['Halfwidth and Fullwidth Forms'](id) // ！？＂＃＄％＆...
        );
         
    }

    /**
     * Draws a glyph offscreen using TinySDF, creating a TinySDF instance lazily.
     */
    _drawGlyph(entry: Entry, stack: string, id: number): StyleGlyph {
        // The CJK fallback font specified by the developer takes precedence over the last resort fontstack in the style specification.
        const usesLocalIdeographFontFamily = stack === defaultStack && this.localIdeographFontFamily !== '' && this._charUsesLocalIdeographFontFamily(id);

        // Keep a separate TinySDF instance for when we need to apply the localIdeographFontFamily fallback to keep the font selection from bleeding into non-CJK text.
        const tinySDFKey = usesLocalIdeographFontFamily ? 'ideographTinySDF' : 'tinySDF';
        entry[tinySDFKey] ||= this._createTinySDF(usesLocalIdeographFontFamily ? this.localIdeographFontFamily : stack);
        const char = entry[tinySDFKey].draw(String.fromCharCode(id));

        /**
         * TinySDF's "top" is the distance from the alphabetic baseline to the top of the glyph.
         * Server-generated fonts specify "top" relative to an origin above the em box (the origin
         * comes from FreeType, but I'm unclear on exactly how it's derived)
         * ref: https://github.com/mapbox/sdf-glyph-foundry
         *
         * Server fonts don't yet include baseline information, so we can't line up exactly with them
         * (and they don't line up with each other)
         * ref: https://github.com/mapbox/node-fontnik/pull/160
         *
         * To approximately align TinySDF glyphs with server-provided glyphs, we use this baseline adjustment
         * factor calibrated to be in between DIN Pro and Arial Unicode (but closer to Arial Unicode)
         */
        const topAdjustment = 27.5;

        const leftAdjustment = 0.5;

        return {
            id,
            bitmap: new AlphaImage({width: char.width || 30 * textureScale, height: char.height || 30 * textureScale}, char.data),
            metrics: {
                width: char.glyphWidth / textureScale || 24,
                height: char.glyphHeight / textureScale || 24,
                left: (char.glyphLeft / textureScale + leftAdjustment) || 0,
                top: char.glyphTop / textureScale - topAdjustment || -8,
                advance: char.glyphAdvance / textureScale || 24,
                isDoubleResolution: true
            }
        };
    }

    _createTinySDF(stack: String | false): TinySDF {
        // Escape and quote the font family list for use in CSS.
        const fontFamilies = stack ? stack.split(',') : [];
        fontFamilies.push(defaultGenericFontFamily);
        const fontFamily = fontFamilies.map(fontName =>
            /[-\w]+/.test(fontName) ? fontName : `'${CSS.escape(fontName)}'`
        ).join(',');

        return new GlyphManager.TinySDF({
            fontSize: 24 * textureScale,
            buffer: 3 * textureScale,
            radius: 8 * textureScale,
            cutoff: 0.25,
            fontFamily: fontFamily,
            fontWeight: this._fontWeight(fontFamilies[0]),
            fontStyle: this._fontStyle(fontFamilies[0]),
            lang: this.lang
        });
    }

    /**
     * Sniffs the font style out of a font family name.
     */
    _fontStyle(fontFamily: string): string {
        if (/italic/i.test(fontFamily)) {
            return 'italic';
        } else if (/oblique/i.test(fontFamily)) {
            return 'oblique';
        }
        return 'normal';
    }

    /**
     * Sniffs the font weight out of a font family name.
     */
    _fontWeight(fontFamily: string): string {
        // Based on the OpenType specification
        // https://learn.microsoft.com/en-us/typography/opentype/spec/os2#usweightclass
        const weightsByName = {
            thin: 100, hairline: 100,
            'extra light': 200, 'ultra light': 200,
            light: 300,
            normal: 400, regular: 400,
            medium: 500,
            semibold: 600, demibold: 600,
            bold: 700,
            'extra bold': 800, 'ultra bold': 800,
            black: 900, heavy: 900,
            'extra black': 950, 'ultra black': 950
        };
        let match;
        for (const [name, weight] of Object.entries(weightsByName)) {
            if (new RegExp(`\\b${name}\\b`, 'i').test(fontFamily)) {
                match = `${weight}`;
            }
        }
        return match;
    }
}
