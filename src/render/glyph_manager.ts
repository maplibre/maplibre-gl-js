import {loadGlyphRange} from '../style/load_glyph_range.ts';
import {FontFaceManager} from './font_face_manager.ts';

import TinySDF from '@mapbox/tiny-sdf';
import {codePointUsesLocalIdeographFontFamily} from '../util/unicode_properties.g.ts';
import {isCluster} from '../util/graphemes.ts';
import {AlphaImage} from '../util/image.ts';
import {ensureError, warnOnce} from '../util/util.ts';

import type {StyleGlyph} from '../style/style_glyph.ts';
import type {RequestManager} from '../util/request_manager.ts';
import type {GetGlyphsResponse} from '../util/actor_messages.ts';
import type {FontFacesSpecification} from '@maplibre/maplibre-gl-style-spec';

import {v8} from '@maplibre/maplibre-gl-style-spec';

type Entry = {
    /**
     * The glyphs drawn or downloaded so far, keyed by grapheme cluster. `null` means the glyph was
     * asked for and is not available: either the range came back without it, or it is a cluster
     * that no font file covers.
     */
    glyphs: Record<string, StyleGlyph | null>;
    requests: {
        [range: number]: Promise<{[_: number]: StyleGlyph | null}>;
    };
    ranges: {
        [range: number]: boolean | null;
    };
    tinySDF?: Promise<TinySDF>;
    ideographTinySDF?: Promise<TinySDF>;
    /**
     * One TinySDF per `font-faces` file this stack draws with, keyed by the file's CSS family.
     */
    fontFaceTinySDFs?: Record<string, Promise<TinySDF>>;
    /**
     * The same, for drawing whole grapheme clusters, which need a wider canvas to fit in.
     */
    clusterTinySDFs?: Record<string, Promise<TinySDF>>;
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

/**
 * How wide a grapheme cluster is allowed to be, as a multiple of the font size.
 *
 * TinySDF sizes its canvas for a single character and cuts off anything past the right edge, but a
 * cluster is a whole syllable: Burmese `လား` is nearly twice as wide as the font size, and a
 * Devanagari conjunct is wider still. Three ems has room for the ones that occur in practice.
 */
const clusterEmsWide = 3;

export class GlyphManager {
    requestManager: RequestManager;
    localIdeographFontFamily: string | false;
    entries: {[stack: string]: Entry};
    url: string;
    lang?: string;
    fontFaceManager: FontFaceManager;

    // exposed as statistics to enable stubbing in unit tests
    static loadGlyphRange: typeof loadGlyphRange = loadGlyphRange;
    static TinySDF: typeof TinySDF = TinySDF;

    constructor(requestManager: RequestManager, localIdeographFontFamily?: string | false, lang?: string) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
        this.lang = lang;
        this.fontFaceManager = new FontFaceManager(requestManager);
    }

    setURL(url?: string | null): void {
        this.url = url;
    }

    /**
     * Replaces the font files the style declares in its `font-faces` property, dropping every glyph
     * drawn with the previous ones.
     */
    setFontFaces(fontFaces?: FontFacesSpecification | null): void {
        this.fontFaceManager.setFontFaces(fontFaces);
        this.entries = {};
    }

    async getGlyphs(glyphs: Record<string, string[]>): Promise<GetGlyphsResponse> {
        const glyphsPromises: Array<Promise<{stack: string; id: string; glyph: StyleGlyph}>> = [];

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                glyphsPromises.push(this._getAndCacheGlyphsPromise(stack, id));
            }
        }

        const updatedGlyphs = await Promise.all(glyphsPromises);

        const result: GetGlyphsResponse = {};

        for (const {stack, id, glyph} of updatedGlyphs) {
            result[stack] ||= {};
            // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
            result[stack][id] = glyph && {
                id: glyph.id,
                bitmap: glyph.bitmap.clone(),
                metrics: glyph.metrics
            };
        }

        return result;
    }

    /**
     * Gets one glyph, which is asked for by grapheme cluster: usually a single character, but for a
     * letter written with marks around it -- a Hebrew vowel point, an Indic vowel sign -- the whole
     * cluster, so that it can be drawn as the one shape it is written as.
     *
     * A cluster of several codepoints has no glyph of its own in a glyphs URL, which serves one
     * codepoint at a time, and none in a system font nobody chose. It can only be drawn from a file
     * the style pinned with `font-faces`; where there is none, this returns nothing and layout falls
     * back to drawing the cluster a codepoint at a time, as it always has.
     *
     * For a single codepoint, a font file the style declared wins over both the glyphs URL and the
     * local fallback fonts: the style asked for that exact file, by name and by unicode range.
     */
    async _getAndCacheGlyphsPromise(stack: string, id: string): Promise<{stack: string; id: string; glyph: StyleGlyph}> {
        // Create an entry for this fontstack if it doesn’t already exist.
        this.entries[stack] ??= {glyphs: {}, requests: {}, ranges: {}};
        const entry = this.entries[stack];

        // Try to get the glyph from the cache of client-side glyphs.
        let glyph = entry.glyphs[id];
        if (glyph !== undefined) {
            return {stack, id, glyph};
        }

        const codePoint = id.codePointAt(0);

        if (isCluster(id)) {
            const fontFaceFamily = this.fontFaceManager.hasFontFaces() ?
                await this.fontFaceManager.getFontFamily(stack, codePoint) :
                null;
            glyph = entry.glyphs[id] = fontFaceFamily ?
                await this._drawGlyph(entry, stack, id, fontFaceFamily) :
                null;
            return {stack, id, glyph};
        }

        if (this.fontFaceManager.hasFontFaces()) {
            const fontFaceFamily = await this.fontFaceManager.getFontFamily(stack, codePoint);
            if (fontFaceFamily) {
                glyph = entry.glyphs[id] = await this._drawGlyph(entry, stack, id, fontFaceFamily);
                return {stack, id, glyph};
            }
        }

        // If the style hasn’t opted into server-side fonts or this codepoint is CJK, draw the glyph locally and cache it.
        if (!this.url || this._charUsesLocalIdeographFontFamily(codePoint)) {
            glyph = entry.glyphs[id] = await this._drawGlyph(entry, stack, id);
            return {stack, id, glyph};
        }

        return await this._downloadAndCacheRangePromise(stack, id);
    }

    /**
     * Gets a glyph from the cache of server-side glyphs, downloading the PBF range it falls in if it
     * is not there yet.
     *
     * Only ever reached for a single codepoint: a glyphs URL serves codepoints, not clusters. What
     * comes back is keyed by codepoint, as the file is, and is cached by grapheme cluster -- which
     * for a codepoint from a glyphs URL is the character itself.
     */
    async _downloadAndCacheRangePromise(stack: string, id: string): Promise<{stack: string; id: string; glyph: StyleGlyph}> {
        const codePoint = id.codePointAt(0);
        const entry = this.entries[stack];
        const range = Math.floor(codePoint / 256);
        if (entry.ranges[range]) {
            return {stack, id, glyph: null};
        }

        // Start downloading this range unless we’re currently downloading it.
        entry.requests[range] ||= GlyphManager.loadGlyphRange(stack, range, this.url, this.requestManager);

        try {
            // Get the response and cache the glyphs from it.
            const response = await entry.requests[range];
            for (const responseId in response) {
                entry.glyphs[String.fromCodePoint(+responseId)] = response[+responseId];
            }
            entry.ranges[range] = true;
            return {stack, id, glyph: response[codePoint] || null};
        } catch (e) {
            // Fall back to drawing the glyph locally and caching it.
            const glyph = entry.glyphs[id] = await this._drawGlyph(entry, stack, id);
            this._warnOnMissingGlyphRange(glyph, range, codePoint, ensureError(e));
            return {stack, id, glyph};
        }
    }

    _warnOnMissingGlyphRange(glyph: StyleGlyph, range: number, id: number, err: Error): void {
        const begin = range * 256;
        const end = begin + 255;
        const codePoint = id.toString(16).padStart(4, '0').toUpperCase();
        warnOnce(`Unable to load glyph range ${range}, ${begin}-${end}. Rendering codepoint U+${codePoint} locally instead. ${err}`);
    }

    /**
     * Returns whether the given codepoint should be rendered locally.
     */
    _charUsesLocalIdeographFontFamily(id: number): boolean {
        return !!this.localIdeographFontFamily && codePointUsesLocalIdeographFontFamily(id);
    }

    /**
     * Draws a glyph offscreen using TinySDF, creating a TinySDF instance lazily.
     *
     * The whole grapheme cluster is handed to TinySDF rather than a codepoint at a time, which is
     * what lets the browser's own text engine place a letter's marks on it.
     *
     * @param fontFaceFamily - the CSS family of the `font-faces` file covering this codepoint, if any
     */
    async _drawGlyph(entry: Entry, stack: string, id: string, fontFaceFamily?: string): Promise<StyleGlyph> {
        const tinySDF = await this._getTinySDF(entry, stack, id, fontFaceFamily);
        const char = tinySDF.draw(id);

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

        // By definition, control characters are invisible and nonspacing.
        const isControl = /^\p{gc=Cf}+$/u.test(id);

        return {
            id: id.codePointAt(0),
            bitmap: new AlphaImage({width: char.width || 30 * textureScale, height: char.height || 30 * textureScale}, char.data),
            metrics: {
                width: isControl ? 0 : (char.glyphWidth / textureScale || 24),
                height: char.glyphHeight / textureScale || 24,
                left: (char.glyphLeft / textureScale + leftAdjustment) || 0,
                top: char.glyphTop / textureScale - topAdjustment || -8,
                advance: isControl ? 0 : (char.glyphAdvance / textureScale || 24),
                isDoubleResolution: true
            }
        };
    }

    /**
     * Returns the TinySDF that draws this grapheme in this fontstack, creating it lazily. A stack
     * keeps one instance per font selection it draws with, so that a fallback applying to some
     * codepoints does not bleed into the rest of the text, and a further one per font file for the
     * clusters drawn from it, which need a wider canvas.
     *
     * A font file carries its own weight and style, so neither is sniffed out of the family name --
     * doing so would ask the browser to synthesize a second helping of both.
     */
    _getTinySDF(entry: Entry, stack: string, id: string, fontFaceFamily?: string): Promise<TinySDF> {
        if (fontFaceFamily) {
            if (isCluster(id)) {
                entry.clusterTinySDFs ??= {};
                entry.clusterTinySDFs[fontFaceFamily] ||= this._createTinySDF(fontFaceFamily, false, clusterEmsWide);
                return entry.clusterTinySDFs[fontFaceFamily];
            }
            entry.fontFaceTinySDFs ??= {};
            entry.fontFaceTinySDFs[fontFaceFamily] ||= this._createTinySDF(fontFaceFamily, false);
            return entry.fontFaceTinySDFs[fontFaceFamily];
        }

        // The CJK fallback font specified by the developer takes precedence over the last resort fontstack in the style specification.
        const usesLocalIdeographFontFamily = stack === defaultStack && this.localIdeographFontFamily !== '' && this._charUsesLocalIdeographFontFamily(id.codePointAt(0));

        // Keep a separate TinySDF instance for when we need to apply the localIdeographFontFamily fallback to keep the font selection from bleeding into non-CJK text.
        const tinySDFKey = usesLocalIdeographFontFamily ? 'ideographTinySDF' : 'tinySDF';
        entry[tinySDFKey] ||= this._createTinySDF(usesLocalIdeographFontFamily ? this.localIdeographFontFamily : stack);
        return entry[tinySDFKey];
    }

    /**
     * Builds the TinySDF that draws with a given font selection.
     *
     * TinySDF derives its canvas from `fontSize + buffer * 4`, so the buffer is the only way in to a
     * wider one. The padding the buffer also stands for is put back afterwards, because the atlas
     * and the shaders expect exactly `GLYPH_PBF_BORDER` of it around every glyph.
     *
     * @param emsWide - how wide, in multiples of the font size, the glyphs drawn with this instance
     * may be before TinySDF cuts them off
     */
    async _createTinySDF(stack: String | false, sniffFontStyles: boolean = true, emsWide: number = 1): Promise<TinySDF> {
        // Escape and quote the font family list for use in CSS.
        const fontFamilies = stack ? stack.split(',') : [];
        fontFamilies.push(defaultGenericFontFamily);
        const fontFamily = fontFamilies.map(fontName =>
            /[-\w]+/.test(fontName) ? fontName : `'${CSS.escape(fontName)}'`
        ).join(',');

        const fontSize = 24 * textureScale;
        const fontWeight = sniffFontStyles ? this._fontWeight(fontFamilies[0]) : undefined;
        const fontStyle = sniffFontStyles ? this._fontStyle(fontFamilies[0]) : 'normal';

        // Await web font load so TinySDF doesn't cache a fallback bitmap. See #7307.
        if (typeof document !== 'undefined' && document.fonts?.load) {
            try {
                await document.fonts.load(`${fontStyle} ${fontWeight || 'normal'} ${fontSize}px ${fontFamily}`);
            } catch (e) {
                warnOnce(`Failed to load font "${fontFamily}": ${ensureError(e).message}`);
            }
        }

        const buffer = 3 * textureScale;
        const tinySDF = new GlyphManager.TinySDF({
            fontSize,
            buffer: Math.max(buffer, Math.ceil(fontSize * (emsWide - 1) / 4)),
            radius: 8 * textureScale,
            cutoff: 0.25,
            fontFamily,
            fontWeight,
            fontStyle,
            lang: this.lang
        });
        (tinySDF as TinySDF & {buffer: number}).buffer = buffer;
        return tinySDF;
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

    destroy(): void {
        for (const stack in this.entries) {
            const entry = this.entries[stack];
            entry.tinySDF = null;
            entry.ideographTinySDF = null;
            entry.fontFaceTinySDFs = {};
            entry.glyphs = {};
            entry.requests = {};
            entry.ranges = {};
        }
        this.entries = {};
        this.fontFaceManager.destroy();
    }
}
