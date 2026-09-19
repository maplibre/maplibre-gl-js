import {getArrayBuffer} from '../util/ajax.ts';
import {ResourceType} from '../util/request_manager.ts';
import {ensureError, warnOnce} from '../util/util.ts';

import type {FontFacesSpecification, MLFontFace} from '@maplibre/maplibre-gl-style-spec';
import type {RequestManager} from '../util/request_manager.ts';

/**
 * An inclusive range of Unicode codepoints, parsed out of a `unicode-range` entry.
 */
export type UnicodeRange = {
    start: number;
    end: number;
};

const MAX_CODE_POINT = 0x10FFFF;

/**
 * What a font file covers when the style does not narrow it down with `unicode-range`.
 */
const DEFAULT_UNICODE_RANGE: UnicodeRange = {start: 0, end: MAX_CODE_POINT};

/**
 * A font file declared by the style, along with the bookkeeping needed to draw with it.
 */
type DeclaredFontFace = {
    /**
     * The font file's URL, as written in the style.
     */
    url: string;
    /**
     * The codepoints the style lets this file cover.
     */
    ranges: UnicodeRange[];
    /**
     * The CSS family name the file is registered under. It is generated rather than taken from the
     * style so that a style cannot restyle the surrounding page by declaring a font face named
     * after one the page uses, and so that each file can be selected on its own.
     */
    family: string;
    /**
     * Resolves to whether the file loaded and can be drawn with. Started the first time a codepoint
     * needs this file, so that a style may declare more fonts than any one map ever draws with.
     */
    loaded?: Promise<boolean>;
};

/**
 * Makes the family names unique across every map on the page, since `document.fonts` is shared.
 */
let nextFamilyId = 0;

/**
 * Parses one `unicode-range` entry, in the CSS grammar the style specification borrows: `U+A5`,
 * `U+0-10FFFF` or `U+4??`.
 * @param value - a single `unicode-range` entry
 * @returns the codepoints it covers, or `null` if it is not a range this can make sense of
 */
function parseUnicodeRange(value: string): UnicodeRange | null {
    const wildcard = /^u\+([0-9a-f]*)(\?+)$/i.exec(value);
    if (wildcard) {
        const [, prefix, questionMarks] = wildcard;
        if (prefix.length + questionMarks.length > 6) return null;
        return clampRange(
            parseInt(`${prefix}${'0'.repeat(questionMarks.length)}`, 16),
            parseInt(`${prefix}${'f'.repeat(questionMarks.length)}`, 16)
        );
    }

    const explicit = /^u\+([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(value);
    if (!explicit) return null;

    const start = parseInt(explicit[1], 16);
    return clampRange(start, explicit[2] === undefined ? start : parseInt(explicit[2], 16));
}

function clampRange(start: number, end: number): UnicodeRange | null {
    if (start > end || start > MAX_CODE_POINT) return null;
    return {start, end: Math.min(end, MAX_CODE_POINT)};
}

/**
 * Whether the style lets this file cover the given codepoint.
 */
function covers(face: DeclaredFontFace, codePoint: number): boolean {
    return face.ranges.some(({start, end}) => codePoint >= start && codePoint <= end);
}

/**
 * Keeps the font files a style declares in its
 * [`font-faces`](https://maplibre.org/maplibre-style-spec/root/#font-faces) property, and hands the
 * {@link GlyphManager} the CSS family to draw a given codepoint with.
 *
 * The files go to the browser's CSS Font Loading API, so any format it can render text with works.
 * Each is registered under a family name of our own making, so that a style cannot restyle the
 * surrounding page and a codepoint can be pinned to one file rather than to whatever font matching
 * picks.
 *
 * Rasterizing happens a grapheme cluster at a time, so a letter reaches the browser's text engine
 * with its marks. Shaping across cluster boundaries still needs the RTL text plugin.
 */
export class FontFaceManager {
    requestManager: RequestManager;
    /**
     * The declared files by the font name used in `text-font`, in the order the style listed them.
     */
    _faces: Record<string, DeclaredFontFace[]>;
    /**
     * Everything handed to `document.fonts`, so that it can all be handed back on destroy.
     */
    _registered: Set<FontFace>;

    constructor(requestManager: RequestManager) {
        this.requestManager = requestManager;
        this._faces = {};
        this._registered = new Set();
    }

    /**
     * Replaces the declared font faces. Nothing is downloaded here: each file waits until a
     * codepoint it covers is actually drawn.
     */
    setFontFaces(fontFaces?: FontFacesSpecification | null): void {
        this._unregisterAll();
        this._faces = {};

        for (const [fontName, declaration] of Object.entries(fontFaces ?? {})) {
            const declarations = Array.isArray(declaration) ? declaration : [declaration];
            this._faces[fontName] = declarations
                .map(entry => this._declareFontFace(fontName, entry))
                .filter(face => face !== null);
        }
    }

    /**
     * Whether the style declared any font face at all, so that the common case of a style without
     * `font-faces` costs nothing.
     */
    hasFontFaces(): boolean {
        return Object.keys(this._faces).length > 0;
    }

    /**
     * Finds the font file to draw a codepoint with: each name of the `text-font` stack in turn, and
     * within a name each declared file, until one covers it. A file that fails to load is skipped,
     * the specification asking for unsupported fonts to be ignored.
     *
     * @returns the CSS family to draw with, or `null` to leave the codepoint to the `glyphs` URL
     */
    async getFontFamily(fontStack: string, codePoint: number): Promise<string | null> {
        for (const fontName of fontStack.split(',')) {
            for (const face of this._faces[fontName.trim()] ?? []) {
                if (!covers(face, codePoint)) continue;

                face.loaded ??= this._loadFontFace(face);
                if (await face.loaded) return face.family;
            }
        }
        return null;
    }

    /**
     * Turns one declaration into a face to draw with, or `null` if there is nothing usable in it.
     *
     * A bare URL is the same as a face that names no `unicode-range`: it covers every codepoint.
     */
    _declareFontFace(fontName: string, declaration: string | MLFontFace): DeclaredFontFace | null {
        const face: MLFontFace = typeof declaration === 'string' ? {url: declaration} : declaration;

        if (typeof face?.url !== 'string') {
            warnOnce(`Ignoring the font face declared for "${fontName}": it has no URL.`);
            return null;
        }

        const family = `maplibre-gl-font-face-${nextFamilyId++}`;
        const unicodeRange = face['unicode-range'];
        if (!unicodeRange?.length) {
            return {url: face.url, ranges: [DEFAULT_UNICODE_RANGE], family};
        }

        const ranges: UnicodeRange[] = [];
        for (const entry of unicodeRange) {
            const range = parseUnicodeRange(entry);
            if (!range) {
                warnOnce(`Ignoring the unicode range "${entry}" of the font face at ${face.url}: it is not a valid range.`);
                continue;
            }
            ranges.push(range);
        }
        if (!ranges.length) return null;

        return {url: face.url, ranges, family};
    }

    /**
     * Downloads a declared file and hands it to the browser, reporting whether it can be drawn with.
     * A failure is not an error: its codepoints fall through to the next file, then to `glyphs`.
     */
    async _loadFontFace(face: DeclaredFontFace): Promise<boolean> {
        if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
            warnOnce(`Ignoring the font face at ${face.url}: this environment has no CSS Font Loading API.`);
            return false;
        }

        let fontFace: FontFace;
        try {
            fontFace = new FontFace(face.family, await this._downloadFontFile(face.url));
            if (!Object.values(this._faces).some(faces => faces.includes(face))) return false;
            document.fonts.add(fontFace);
            this._registered.add(fontFace);
            await fontFace.load();
            return true;
        } catch (e) {
            if (fontFace) this._unregister(fontFace);
            warnOnce(`Ignoring the font face at ${face.url}: ${ensureError(e).message}`);
            return false;
        }
    }

    /**
     * Downloads a font file, giving the map's `transformRequest` a chance to rewrite the request the
     * same way it gets one for a glyph range.
     */
    async _downloadFontFile(url: string): Promise<ArrayBuffer> {
        const request = await this.requestManager.transformRequest(url, ResourceType.Glyphs);
        const response = await getArrayBuffer(request, new AbortController());
        if (!response?.data) {
            throw new Error(`the response was empty for the font file at ${url}`);
        }
        return response.data;
    }

    _unregister(fontFace: FontFace): void {
        document.fonts?.delete(fontFace);
        this._registered.delete(fontFace);
    }

    _unregisterAll(): void {
        for (const fontFace of this._registered) {
            document.fonts?.delete(fontFace);
        }
        this._registered.clear();
    }

    destroy(): void {
        this._unregisterAll();
        this._faces = {};
    }
}
