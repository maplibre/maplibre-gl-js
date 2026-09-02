import {FontFaceManager} from './font_face_manager.ts';

import TinySDF, {type TinySDFOptions} from '@mapbox/tiny-sdf';
import {codePointUsesLocalIdeographFontFamily} from '../util/unicode_properties.g.ts';
import {isCluster} from '../util/graphemes.ts';
import {AlphaImage} from '../util/image.ts';
import {ensureError, warnOnce} from '../util/util.ts';
import {getArrayBuffer} from '../util/ajax.ts';
import {ResourceType} from '../util/request_manager.ts';
import {parseGlyphPbf} from '../style/parse_glyph_pbf.ts';

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
    requests: Record<number, Promise<{[_: number]: StyleGlyph | null}>>;
    ranges: Record<number, boolean | null>;
    tinySDF?: Promise<Rasterizer>;
    ideographTinySDF?: Promise<Rasterizer>;
    /**
     * One TinySDF per `font-faces` file this stack draws with, keyed by the file's CSS family.
     */
    fontFaceTinySDFs?: Record<string, Promise<Rasterizer>>;
    /**
     * The same, for drawing whole grapheme clusters, which need a wider canvas to fit in.
     */
    clusterTinySDFs?: Record<string, Promise<Rasterizer>>;
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
 * The rasterizer, as it really is. TinySDF carries the `buffer` it was built with, which its type
 * declaration leaves out and which the canvas has to be widened through.
 */
export type Rasterizer = TinySDF & {buffer: number};

/**
 * Builds the thing that rasterizes a glyph. Taken as a dependency so that a test can stand in for
 * the canvas it would otherwise need to draw on.
 *
 * @param options - what to draw with, whose `buffer` sizes the canvas
 * @param padding - the room to leave around each glyph in the bitmap, which is not that buffer
 */
export type CreateRasterizer = (options: TinySDFOptions, padding: number) => Rasterizer;

const defaultCreateRasterizer: CreateRasterizer = (options, padding) => {
    const tinySDF = new TinySDF(options) as Rasterizer;
    tinySDF.buffer = padding;
    return tinySDF;
};

/**
 * How wide a grapheme cluster may be drawn, in multiples of the font size.
 *
 * TinySDF sizes its canvas for a single character and cuts off the rest, but a cluster is a whole
 * syllable: Burmese `လား` is nearly twice the font size. Three ems fits the ones that occur.
 */
const clusterEmsWide = 3;

export class GlyphManager {
    requestManager: RequestManager;
    localIdeographFontFamily: string | false;
    entries: Record<string, Entry>;
    url: string;
    lang?: string;
    fontFaceManager: FontFaceManager;
    createRasterizer: CreateRasterizer;

    constructor(
        requestManager: RequestManager,
        localIdeographFontFamily?: string | false,
        lang?: string,
        createRasterizer: CreateRasterizer = defaultCreateRasterizer
    ) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
        this.lang = lang;
        this.fontFaceManager = new FontFaceManager(requestManager);
        this.createRasterizer = createRasterizer;
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
     * Gets one glyph, asked for by grapheme cluster so that a letter and its marks are drawn as the
     * one shape they are written as.
     *
     * Only a file the style pinned with `font-faces` can draw a cluster -- a glyphs URL serves
     * codepoints -- so where none covers it this returns nothing and layout falls back to codepoints.
     * For a single codepoint a declared file still wins over the glyphs URL and the local fallbacks.
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
        const fontFaceFamily = this.fontFaceManager.hasFontFaces() ?
            await this.fontFaceManager.getFontFamily(stack, codePoint) :
            null;

        if (fontFaceFamily) {
            glyph = entry.glyphs[id] = await this._drawGlyph(entry, stack, id, fontFaceFamily);
            return {stack, id, glyph};
        }

        if (isCluster(id)) {
            glyph = entry.glyphs[id] = null;
            return {stack, id, glyph};
        }

        // If the style hasn’t opted into server-side fonts or this codepoint is CJK, draw the glyph locally and cache it.
        if (!this.url || this._charUsesLocalIdeographFontFamily(codePoint)) {
            glyph = entry.glyphs[id] = await this._drawGlyph(entry, stack, id);
            return {stack, id, glyph};
        }

        return await this._downloadAndCacheRangePromise(stack, id);
    }

    /**
     * Gets a glyph from the server-side cache, downloading the PBF range it falls in if need be.
     *
     * Only reached for a single codepoint. What comes back is keyed by codepoint, as the file is,
     * and is cached by cluster -- which for one codepoint is the character itself.
     */
    async _downloadAndCacheRangePromise(stack: string, id: string): Promise<{stack: string; id: string; glyph: StyleGlyph}> {
        const codePoint = id.codePointAt(0);
        const entry = this.entries[stack];
        const range = Math.floor(codePoint / 256);
        if (entry.ranges[range]) {
            return {stack, id, glyph: null};
        }

        // Start downloading this range unless we’re currently downloading it.
        entry.requests[range] ||= this._loadGlyphRange(stack, range);

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

    /**
     * Downloads one range of 256 codepoints from the glyphs URL and parses the glyphs out of it.
     */
    async _loadGlyphRange(fontstack: string, range: number): Promise<Record<number, StyleGlyph | null>> {
        const begin = range * 256;
        const end = begin + 255;

        const request = await this.requestManager.transformRequest(
            this.url.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`),
            ResourceType.Glyphs
        );

        const response = await getArrayBuffer(request, new AbortController());
        if (!response?.data) {
            throw new Error(`Could not load glyph range. range: ${range}, ${begin}-${end}`);
        }

        const glyphs = {};
        for (const glyph of parseGlyphPbf(response.data)) {
            glyphs[glyph.id] = glyph;
        }
        return glyphs;
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
     * Draws a glyph offscreen using TinySDF, created lazily. The whole cluster goes to TinySDF, which
     * is what lets the browser's text engine place a letter's marks on it.
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
     * Returns the TinySDF that draws this grapheme, created lazily. A stack keeps one per font
     * selection, so a fallback cannot bleed into the rest of the text, and one more per font file
     * for the clusters drawn from it, which need a wider canvas.
     *
     * A font file carries its own weight and style, so neither is sniffed out of the family name.
     * Where no file covers the grapheme, `localIdeographFontFamily` beats the last resort fontstack.
     */
    _getTinySDF(entry: Entry, stack: string, id: string, fontFaceFamily?: string): Promise<Rasterizer> {
        if (fontFaceFamily) {
            const cluster = isCluster(id);
            const cache = cluster ? 'clusterTinySDFs' : 'fontFaceTinySDFs';

            entry[cache] ??= {};
            entry[cache][fontFaceFamily] ||= this._createTinySDF(fontFaceFamily, false, cluster ? clusterEmsWide : 1);
            return entry[cache][fontFaceFamily];
        }

        const usesLocalIdeographFontFamily = stack === defaultStack &&
            this.localIdeographFontFamily !== '' &&
            this._charUsesLocalIdeographFontFamily(id.codePointAt(0));
        const cache = usesLocalIdeographFontFamily ? 'ideographTinySDF' : 'tinySDF';

        entry[cache] ||= this._createTinySDF(usesLocalIdeographFontFamily ? this.localIdeographFontFamily : stack);
        return entry[cache];
    }

    /**
     * Builds the TinySDF that draws with a given font selection.
     *
     * TinySDF derives its canvas from `fontSize + buffer * 4`, so the buffer is the only way in to a
     * wider one. It also stands for the padding the atlas expects to be `GLYPH_PBF_BORDER`, so the
     * two are passed separately.
     *
     * @param emsWide - how wide the glyphs may be, in font sizes, before TinySDF cuts them off
     */
    async _createTinySDF(stack: String | false, sniffFontStyles: boolean = true, emsWide: number = 1): Promise<Rasterizer> {
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

        const padding = 3 * textureScale;
        return this.createRasterizer({
            fontSize,
            buffer: Math.max(padding, Math.ceil(fontSize * (emsWide - 1) / 4)),
            radius: 8 * textureScale,
            cutoff: 0.25,
            fontFamily,
            fontWeight,
            fontStyle,
            lang: this.lang
        }, padding);
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
