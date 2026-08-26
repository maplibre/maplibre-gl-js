import {describe, afterEach, test, expect, vi} from 'vitest';
import {parseGlyphPbf} from '../style/parse_glyph_pbf.ts';
import {GlyphManager, type LoadGlyphRange} from './glyph_manager.ts';
import fs from 'fs';
import {RequestManager} from '../util/request_manager.ts';
import {fakeServer, type FakeServer} from 'nise';
import TinySDF, {type TinySDFOptions} from '@mapbox/tiny-sdf';
import type {CreateRasterizer} from './glyph_manager.ts';

describe('GlyphManager', () => {
    const GLYPHS = {};
    for (const glyph of parseGlyphPbf(fs.readFileSync('./test/unit/assets/0-255.pbf'))) {
        GLYPHS[glyph.id] = glyph;
    }

    const identityTransform = new RequestManager();

    /**
     * Glyphs are asked for by grapheme cluster, and these tests are written in codepoints, so this
     * says the one in terms of the other.
     */
    const char = (codePoint: number) => String.fromCodePoint(codePoint);

    function createGlyphManager(
        remoteEnabled: boolean,
        font?: string | false,
        language?: string,
        loadGlyphRange?: LoadGlyphRange,
        createRasterizer?: CreateRasterizer
    ): GlyphManager {
        const manager = new GlyphManager(identityTransform, font, language, loadGlyphRange, createRasterizer);
        if (remoteEnabled) {
            manager.setURL('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
        }
        return manager;
    }

    /**
     * A stand-in for the range loader that answers every request with the fixture.
     */
    function serveGlyphRanges() {
        return vi.fn().mockResolvedValue(GLYPHS) as unknown as LoadGlyphRange;
    }

    /**
     * A stand-in for the rasterizer, so that nothing has to be drawn on a canvas.
     */
    function fakeRasterizer(draw: (text: string) => any = () => GLYPHS[0]) {
        return vi.fn((_options: TinySDFOptions) => ({draw}));
    }

    afterEach(() => {
        vi.clearAllMocks();
        delete (document as any).fonts;
    });

    test('GlyphManager requests 0-255 PBF', async () => {
        const loadGlyphRange = serveGlyphRanges();
        const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange);

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(55)]});

        expect(returnedGlyphs['Arial Unicode MS'][char(55)].metrics.advance).toBe(12);
        expect(loadGlyphRange).toHaveBeenCalledExactlyOnceWith(
            'Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', identityTransform);
    });

    test('GlyphManager doesn\'t request twice 0-255 PBF if a glyph is missing', async () => {
        const loadGlyphRange = serveGlyphRanges();
        const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange);

        await manager.getGlyphs({'Arial Unicode MS': [char(0x01)]});
        expect(manager.entries['Arial Unicode MS'].ranges[0]).toBe(true);
        expect(loadGlyphRange).toHaveBeenCalledTimes(1);

        // We remove all requests as in getGlyphs code.
        delete manager.entries['Arial Unicode MS'].requests[0];

        await manager.getGlyphs({'Arial Unicode MS': [char(0x01)]});
        expect(manager.entries['Arial Unicode MS'].ranges[0]).toBe(true);
        expect(loadGlyphRange).toHaveBeenCalledTimes(1);
    });

    test('GlyphManager requests remote CJK PBF', async () => {
        const manager = createGlyphManager(true, undefined, undefined, serveGlyphRanges());

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x5e73)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x5e73)]).toBeNull(); // The fixture returns a PBF without the glyph we requested
    });

    test('GlyphManager requests remote non-BMP, non-CJK PBF', async () => {
        const manager = createGlyphManager(true, undefined, undefined, serveGlyphRanges());

        // Request Egyptian hieroglyph 𓃰
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x1e0f0)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x1e0f0)]).toBeNull(); // The fixture returns a PBF without the glyph we requested
    });

    test('GlyphManager does not cache CJK chars that should be rendered locally', async () => {
        // Every range comes back full, so anything not drawn locally is found on the server.
        const loadGlyphRange = vi.fn((_stack, range) => {
            const overlappingGlyphs = {};
            for (let i = range * 256, j = 0; j < 256; i++, j++) {
                overlappingGlyphs[i] = GLYPHS[j];
            }
            return Promise.resolve(overlappingGlyphs);
        }) as unknown as LoadGlyphRange;

        const manager = createGlyphManager(true, 'sans-serif', undefined, loadGlyphRange);

        //Request char that overlaps Katakana range
        let returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x3005)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x3005)]).not.toBeNull();
        //Request char from Katakana range (te テ)
        returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x30C6)]});
        const glyph = returnedGlyphs['Arial Unicode MS'][char(0x30c6)];
        //Ensure that te is locally generated.
        expect(glyph.bitmap.height).toBe(12);
        expect(glyph.bitmap.width).toBe(12);
    });

    test('GlyphManager generates CJK PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Chinese character píng 平
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x5e73)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x5e73)].metrics.advance).toBe(0.5);
    });

    test('GlyphManager generates non-BMP CJK PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Chinese character biáng 𰻞
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x30EDE)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x30EDE)].metrics.advance).toBe(1);
    });

    test('GlyphManager generates Katakana PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Katakana letter te テ
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x30c6)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x30c6)].metrics.advance).toBe(0.5);
    });

    test('GlyphManager generates Hiragana PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        //Hiragana letter te て
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x3066)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x3066)].metrics.advance).toBe(0.5);
    });

    test('GlyphManager consistently generates CJKV text locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Space
        expect(manager._charUsesLocalIdeographFontFamily(0x0020)).toBe(false);
        // Chinese character píng 平
        expect(manager._charUsesLocalIdeographFontFamily(0x5e73)).toBe(true);
        // Chinese character biáng 𰻞
        expect(manager._charUsesLocalIdeographFontFamily(0x30EDE)).toBe(true);
        // Katakana letter te テ
        expect(manager._charUsesLocalIdeographFontFamily(0x30c6)).toBe(true);
        // Hiragana letter te て
        expect(manager._charUsesLocalIdeographFontFamily(0x3066)).toBe(true);
        // Hangul letter a 아
        expect(manager._charUsesLocalIdeographFontFamily(0xC544)).toBe(true);
        // Japanese full-width dash ー
        expect(manager._charUsesLocalIdeographFontFamily(0x30FC)).toBe(true);
        // Halfwidth and Fullwidth Forms: full-width exclamation ！
        expect(manager._charUsesLocalIdeographFontFamily(0xFF01)).toBe(true);
        // CJK Symbols and Punctuation: Japanese Post mark 〒
        expect(manager._charUsesLocalIdeographFontFamily(0x3012)).toBe(true);
    });

    test('GlyphManager locally generates Latin character', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        // A
        const returnedGlyphs = await manager.getGlyphs({'Times Old Roman': [char(0x41)]});
        expect(returnedGlyphs['Times Old Roman'][char(0x41)].metrics.width).toBeGreaterThan(0);
        expect(returnedGlyphs['Times Old Roman'][char(0x41)].metrics.advance).toBeGreaterThan(0);
    });

    test('GlyphManager locally generates nonspacing control character', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        // U+202E RIGHT-TO-LEFT OVERRIDE
        const returnedGlyphs = await manager.getGlyphs({'Ctrl Alt Del': [char(0x202e)]});
        expect(returnedGlyphs['Ctrl Alt Del'][char(0x202e)].metrics.width).toBe(0);
        expect(returnedGlyphs['Ctrl Alt Del'][char(0x202e)].metrics.advance).toBe(0);
    });

    test('GlyphManager matches font styles', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        expect(manager._fontStyle('Swiss Italic')).toBe('italic');
        expect(manager._fontStyle('Swiss Oblique')).toBe('oblique');
        expect(manager._fontStyle('Swiss Roman')).toBe('normal');
        expect(manager._fontStyle('Swiss Cursive')).toBe('normal');
    });

    test('GlyphManager matches font weights', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        expect(manager._fontWeight('Swiss Thin')).toBe('100');
        expect(manager._fontWeight('Swiss Regular')).toBe('400');
        expect(manager._fontWeight('Swiss Bold')).toBe('700');
        expect(manager._fontWeight('Swiss Extra Bold')).toBe('800');
        expect(manager._fontWeight('Swiss Cheese')).toBeUndefined();
    });

    test('GlyphManager generates missing PBF locally', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loadGlyphRange = vi.fn().mockRejectedValue(new Error('404 Not Found')) as unknown as LoadGlyphRange;
        const manager = createGlyphManager(true, 'sans-serif', undefined, loadGlyphRange);

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x10e1)]});

        expect(returnedGlyphs['Arial Unicode MS'][char(0x10e1)].metrics.advance).toBeGreaterThan(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Unable to load glyph range'));
    });

    test('GlyphManager caches locally generated glyphs', async () => {

        const manager = createGlyphManager(true, 'sans-serif');
        const drawSpy = vi.spyOn(TinySDF.prototype, 'draw').mockReturnValue({data: new Uint8ClampedArray(60 * 60)} as any);

        // Katakana letter te
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x30c6)]});
        expect(returnedGlyphs['Arial Unicode MS'][char(0x30c6)].metrics.advance).toBe(24);
        await manager.getGlyphs({'Arial Unicode MS': [char(0x30c6)]});
        expect(drawSpy).toHaveBeenCalledTimes(1);
    });

    test('GlyphManager passes no language to TinySDF by default', async () => {
        const createRasterizer = fakeRasterizer();
        const manager = createGlyphManager(true, 'sans-serif', undefined, undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': [char(0x30c6)]});
        expect(createRasterizer).toHaveBeenCalledWith(expect.not.objectContaining({lang: expect.anything()}));
    });

    test('GlyphManager sets the language on TinySDF', async () => {
        const createRasterizer = fakeRasterizer();
        const manager = createGlyphManager(true, 'sans-serif', 'zh', undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': [char(0x30c6)]});
        expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({lang: 'zh'}));
    });

    test('awaits document.fonts.load before instantiating TinySDF', async () => {
        const loadSpy = vi.fn(() => Promise.resolve([]));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': [char(0x41)]});

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(createRasterizer).toHaveBeenCalledTimes(1);
        expect(loadSpy.mock.invocationCallOrder[0]).toBeLessThan(createRasterizer.mock.invocationCallOrder[0]);
    });

    test('still instantiates TinySDF when document.fonts.load rejects', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loadSpy = vi.fn(() => Promise.reject(new Error('font not found')));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, undefined, createRasterizer);
        const result = await manager.getGlyphs({'Arial Unicode MS': [char(0x41)]});

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(createRasterizer).toHaveBeenCalledTimes(1);
        expect(result['Arial Unicode MS'][char(0x41)]).toBeDefined();
    });

    test('memoizes document.fonts.load per fontstack', async () => {
        const loadSpy = vi.fn(() => Promise.resolve([]));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': [char(0x41)]});
        await manager.getGlyphs({'Arial Unicode MS': [char(0x42)]});
        await manager.getGlyphs({'Arial Unicode MS': [char(0x43)]});

        expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    describe('font-faces', () => {
        let server: FakeServer;

        /**
         * Puts a CSS Font Loading API and a font server in place that accept every file, so that a
         * declared font face is always available to draw with.
         */
        function stubFontFaces() {
            Object.defineProperty(document, 'fonts', {
                configurable: true,
                value: {load: () => Promise.resolve([]), add: () => {}, delete: () => {}}
            });
            (globalThis as any).FontFace = class {
                family: string;
                constructor(family: string) { this.family = family; }
                load = () => Promise.resolve(this);
            };
            global.fetch = null;
            server = fakeServer.create({autoRespond: true, autoRespondAfter: 0});
            server.respondWith(function (request) { request.respond(200, undefined, 'font file'); });
        }

        afterEach(() => {
            delete (globalThis as any).FontFace;
            server?.restore();
            server = undefined;
        });

        test('draws a covered codepoint with the declared font file instead of downloading a range', async () => {
            stubFontFaces();
            const loadGlyphRange = serveGlyphRanges();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]});

            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(0x1780)]});

            expect(returnedGlyphs['Arial Unicode MS'][char(0x1780)]).toBeDefined();
            expect(loadGlyphRange).not.toHaveBeenCalled();
            expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({
                fontFamily: expect.stringMatching(/^maplibre-gl-font-face-\d+,sans-serif$/)
            }));
        });

        test('draws a grapheme cluster as one glyph, from the file covering the letter it starts with', async () => {
            stubFontFaces();
            const loadGlyphRange = serveGlyphRanges();
            const drawn: string[] = [];
            const createRasterizer = fakeRasterizer((text) => { drawn.push(text); return GLYPHS[0]; });

            const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/hebrew.ttf'});

            // A Hebrew letter with a sheva and a shin dot on it.
            const cluster = '\u05E9\u05B0\u05C1';
            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [cluster]});

            expect(returnedGlyphs['Arial Unicode MS'][cluster]).toBeDefined();
            expect(drawn).toContain(cluster);
            expect(loadGlyphRange).not.toHaveBeenCalled();
        });

        test('leaves a cluster no declared file covers undrawn, so that layout can fall back', async () => {
            stubFontFaces();
            const loadGlyphRange = serveGlyphRanges();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange, createRasterizer);
            // Declared for Khmer only, so it does not cover the Hebrew letter this cluster starts with.
            manager.setFontFaces({'Arial Unicode MS': [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]});

            const cluster = '\u05E9\u05B0\u05C1';
            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [cluster]});

            expect(returnedGlyphs['Arial Unicode MS'][cluster]).toBeNull();
        });

        test('leaves a codepoint outside every declared range to the glyphs URL', async () => {
            stubFontFaces();
            const loadGlyphRange = serveGlyphRanges();

            const manager = createGlyphManager(true, undefined, undefined, loadGlyphRange);
            manager.setFontFaces({'Arial Unicode MS': [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]});

            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': [char(55)]});

            expect(returnedGlyphs['Arial Unicode MS'][char(55)].metrics.advance).toBe(12);
            expect(loadGlyphRange).toHaveBeenCalledTimes(1);
        });

        test('does not sniff a weight or a style out of the font name, which the file already carries', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Noto Sans Bold Italic': 'https://localhost/noto-bold-italic.ttf'});
            await manager.getGlyphs({'Noto Sans Bold Italic': [char(0x41)]});

            expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({fontWeight: undefined, fontStyle: 'normal'}));
        });

        test('keeps one TinySDF per declared file so a fallback cannot bleed into the rest of the text', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': [
                {url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']},
                {url: 'https://localhost/devanagari.ttf', 'unicode-range': ['U+0900-097F']}
            ]});

            await manager.getGlyphs({'Arial Unicode MS': [char(0x1780), char(0x1781), char(0x0915)]});

            const families = createRasterizer.mock.calls.map(([options]) => options.fontFamily);
            expect(new Set(families).size).toBe(2);
        });

        test('redraws with the new font faces rather than serving the glyphs cached from the old ones', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/noto.ttf'});
            await manager.getGlyphs({'Arial Unicode MS': [char(0x41)]});

            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/other.ttf'});
            await manager.getGlyphs({'Arial Unicode MS': [char(0x41)]});

            const families = createRasterizer.mock.calls.map(([options]) => options.fontFamily);
            expect(families).toHaveLength(2);
            expect(families[0]).not.toBe(families[1]);
        });

        test('gives a cluster a canvas wide enough that it is not cut off', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/myanmar.ttf'});

            // A Burmese syllable, which is drawn nearly twice as wide as a single character.
            await manager.getGlyphs({'Arial Unicode MS': ['\u101C\u102C\u1038', char(0x41)]});

            const buffers = createRasterizer.mock.calls.map(([options]) => options.buffer);
            expect(Math.max(...buffers)).toBeGreaterThan(Math.min(...buffers));
        });
    });
});
