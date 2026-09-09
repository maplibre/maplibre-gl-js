import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {parseGlyphPbf} from '../style/parse_glyph_pbf.ts';
import {GlyphManager} from './glyph_manager.ts';
import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager.ts';
import {fakeServer, type FakeServer} from 'nise';
import {bufferToArrayBuffer} from '../util/test/util.ts';
import TinySDF, {type TinySDFOptions} from '@mapbox/tiny-sdf';
import type {CreateRasterizer} from './glyph_manager.ts';
import {toGraphemes} from '../util/graphemes.ts';

describe('GlyphManager', () => {
    const pbf = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/0-255.pbf'));
    const GLYPHS = {};
    for (const glyph of parseGlyphPbf(pbf)) {
        GLYPHS[glyph.id] = glyph;
    }

    const identityTransform = new RequestManager();
    let server: FakeServer;

    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create({autoRespond: true, autoRespondAfter: 0});
    });

    function char(codePoint: number) {
        return String.fromCodePoint(codePoint);
    }

    function createGlyphManager(
        remoteEnabled: boolean,
        font?: string | false,
        language?: string,
        createRasterizer?: CreateRasterizer
    ): GlyphManager {
        const manager = new GlyphManager(identityTransform, font, language, createRasterizer);
        if (remoteEnabled) {
            manager.setURL('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
        }
        return manager;
    }

    function serveGlyphRanges() {
        server.respondWith(/\.pbf$/, function (request) {
            request.respond(200, undefined, bufferToArrayBuffer(pbf) as unknown as string);
        });
    }

    function glyphRangeRequests() {
        return server.requests.filter(request => request.url.endsWith('.pbf'));
    }

    function fakeRasterizer(draw: (text: string) => any = () => GLYPHS[0]) {
        return vi.fn((_options: TinySDFOptions, padding: number) => ({draw, buffer: padding}));
    }

    afterEach(() => {
        vi.clearAllMocks();
        server.restore();
        delete (document as any).fonts;
    });

    test('GlyphManager shares a 0-255 PBF request between different glyphs', async () => {
        serveGlyphRanges();
        const transformRequest = vi.fn((url: string) => ({url}));
        const manager = new GlyphManager(new RequestManager(transformRequest));
        manager.setURL('https://localhost/fonts/v1/{fontstack}/{range}.pbf');

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(55), char(56)], vertical: []}});

        expect(returnedGlyphs['Arial Unicode MS'].normal[char(55)].metrics.advance).toBe(12);
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(56)].metrics).toEqual(GLYPHS[56].metrics);
        const cachedRange = await manager.getGlyphs({'Arial Unicode MS': {normal: ['A'], vertical: []}});
        expect(cachedRange['Arial Unicode MS'].normal.A.metrics).toEqual(GLYPHS[65].metrics);
        expect(transformRequest).toHaveBeenCalledExactlyOnceWith(
            'https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs');
    });

    test('GlyphManager doesn\'t request twice 0-255 PBF if a glyph is missing', async () => {
        server.respondWith(/\.pbf$/, [200, {}, new ArrayBuffer(0)]);
        const manager = createGlyphManager(true);

        const missing = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x01)], vertical: []}});
        expect(missing['Arial Unicode MS'].normal[char(0x01)]).toBeNull();
        const next = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x01), char(0x02), '7'], vertical: []}});
        expect(next['Arial Unicode MS'].normal[char(0x02)]).toBeNull();
        expect(next['Arial Unicode MS'].normal['7']).toBeNull();
        expect(glyphRangeRequests()).toHaveLength(1);
    });

    test('GlyphManager retries a failed glyph load shared by concurrent callers', async () => {
        const draw = vi.fn(function (_text: string) {
            return {
                data: new Uint8ClampedArray(16).fill(100),
                width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
            };
        }).mockImplementationOnce(() => { throw new Error('draw failed'); });
        const manager = createGlyphManager(false, undefined, undefined, fakeRasterizer(draw));
        const request = {Test: {normal: ['a'], vertical: []}};

        const first = manager.getGlyphs(request);
        const concurrent = manager.getGlyphs(request);
        await Promise.all([
            expect(first).rejects.toThrow('draw failed'),
            expect(concurrent).rejects.toThrow('draw failed')
        ]);
        expect(draw).toHaveBeenCalledTimes(1);

        const glyphs = await manager.getGlyphs(request);
        expect(glyphs.Test.normal.a.bitmap.data[0]).toBe(100);
        await expect(manager.getGlyphs(request)).resolves.toEqual(glyphs);
        expect(draw).toHaveBeenCalledTimes(2);
    });

    test('GlyphManager requests remote CJK PBF', async () => {
        serveGlyphRanges();
        const manager = createGlyphManager(true);

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x5e73)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x5e73)]).toBeNull(); // The fixture returns a PBF without the glyph we requested
    });

    test('GlyphManager requests remote non-BMP, non-CJK PBF', async () => {
        serveGlyphRanges();
        const manager = createGlyphManager(true);

        // Request Egyptian hieroglyph 𓃰
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x1e0f0)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x1e0f0)]).toBeNull(); // The fixture returns a PBF without the glyph we requested
    });

    test('GlyphManager does not cache CJK chars that should be rendered locally', async () => {
        serveGlyphRanges();
        const manager = createGlyphManager(true, 'sans-serif');

        //Request char that overlaps Katakana range
        let returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x3005)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x3005)]).not.toBeNull();
        //Request char from Katakana range (te テ)
        returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30C6)], vertical: []}});
        const glyph = returnedGlyphs['Arial Unicode MS'].normal[char(0x30c6)];
        //Ensure that te is locally generated.
        expect(glyph.bitmap.height).toBe(12);
        expect(glyph.bitmap.width).toBe(12);
    });

    test('GlyphManager generates CJK PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Chinese character píng 平
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x5e73)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x5e73)].metrics.advance).toBe(0.5);
    });

    test('GlyphManager generates non-BMP CJK PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Chinese character biáng 𰻞
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30EDE)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x30EDE)].metrics.advance).toBe(1);
    });

    test('GlyphManager generates Katakana PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        // Katakana letter te テ
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30c6)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x30c6)].metrics.advance).toBe(0.5);
    });

    test('GlyphManager generates Hiragana PBF locally', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        //Hiragana letter te て
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x3066)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x3066)].metrics.advance).toBe(0.5);
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
        const returnedGlyphs = await manager.getGlyphs({'Times Old Roman': {normal: [char(0x41)], vertical: []}});
        expect(returnedGlyphs['Times Old Roman'].normal[char(0x41)].metrics.width).toBeGreaterThan(0);
        expect(returnedGlyphs['Times Old Roman'].normal[char(0x41)].metrics.advance).toBeGreaterThan(0);
    });

    test('GlyphManager locally generates nonspacing control character', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        // U+202E RIGHT-TO-LEFT OVERRIDE
        const returnedGlyphs = await manager.getGlyphs({'Ctrl Alt Del': {normal: [char(0x202e)], vertical: []}});
        expect(returnedGlyphs['Ctrl Alt Del'].normal[char(0x202e)].metrics.width).toBe(0);
        expect(returnedGlyphs['Ctrl Alt Del'].normal[char(0x202e)].metrics.advance).toBe(0);
    });

    test('GlyphManager locally generates a grapheme cluster when the style has no glyphs URL', async () => {
        const manager = createGlyphManager(false, 'sans-serif');

        // \u0926\u093f is Devanagari DA with the vowel sign I, which is written as one shape
        const cluster = '\u0926\u093f';
        const returnedGlyphs = await manager.getGlyphs({'Noto Sans': {normal: [cluster], vertical: []}});

        expect(returnedGlyphs['Noto Sans'].normal[cluster].metrics.advance).toBeGreaterThan(0);
    });

    test('GlyphManager locally generates a grapheme cluster the glyphs URL has no way to serve', async () => {
        const manager = createGlyphManager(true, 'sans-serif');

        const cluster = '\u0926\u093f';
        const returnedGlyphs = await manager.getGlyphs({'Noto Sans': {normal: [cluster], vertical: []}});

        expect(returnedGlyphs['Noto Sans'].normal[cluster].metrics.advance).toBeGreaterThan(0);
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
        server.respondWith(function (request) { request.respond(404, undefined, 'Not Found'); });
        const manager = createGlyphManager(true, 'sans-serif');

        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x10e1)], vertical: []}});

        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x10e1)].metrics.advance).toBeGreaterThan(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Unable to load glyph range'));
    });

    test('GlyphManager caches locally generated glyphs', async () => {

        const manager = createGlyphManager(true, 'sans-serif');
        const drawSpy = vi.spyOn(TinySDF.prototype, 'draw').mockReturnValue({data: new Uint8ClampedArray(60 * 60)} as any);

        // Katakana letter te
        const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30c6)], vertical: []}});
        expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x30c6)].metrics.advance).toBe(24);
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30c6)], vertical: []}});
        expect(drawSpy).toHaveBeenCalledTimes(1);
    });

    test('GlyphManager passes no language to TinySDF by default', async () => {
        const createRasterizer = fakeRasterizer();
        const manager = createGlyphManager(true, 'sans-serif', undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30c6)], vertical: []}});
        expect(createRasterizer).toHaveBeenCalledWith(expect.not.objectContaining({lang: expect.anything()}), expect.any(Number));
    });

    test('GlyphManager sets the language on TinySDF', async () => {
        const createRasterizer = fakeRasterizer();
        const manager = createGlyphManager(true, 'sans-serif', 'zh', createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x30c6)], vertical: []}});
        expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({lang: 'zh'}), expect.any(Number));
    });

    test('awaits document.fonts.load before instantiating TinySDF', async () => {
        const loadSpy = vi.fn(() => Promise.resolve([]));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x41)], vertical: []}});

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(createRasterizer).toHaveBeenCalledTimes(1);
        expect(loadSpy.mock.invocationCallOrder[0]).toBeLessThan(createRasterizer.mock.invocationCallOrder[0]);
    });

    test('still instantiates TinySDF when document.fonts.load rejects', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loadSpy = vi.fn(() => Promise.reject(new Error('font not found')));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, createRasterizer);
        const result = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x41)], vertical: []}});

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(createRasterizer).toHaveBeenCalledTimes(1);
        expect(result['Arial Unicode MS'].normal[char(0x41)]).toBeDefined();
    });

    test('memoizes document.fonts.load per fontstack', async () => {
        const loadSpy = vi.fn(() => Promise.resolve([]));
        Object.defineProperty(document, 'fonts', {configurable: true, value: {load: loadSpy}});
        const createRasterizer = fakeRasterizer();

        const manager = createGlyphManager(false, 'sans-serif', undefined, createRasterizer);
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x41)], vertical: []}});
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x42)], vertical: []}});
        await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x43)], vertical: []}});

        expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    describe('font-faces', () => {
        function stubFontFaces() {
            Object.defineProperty(document, 'fonts', {
                configurable: true,
                value: {load: () => Promise.resolve([]), add: () => {}, delete: () => {}}
            });
            (globalThis as any).FontFace = class {
                family: string;
                featureSettings: string;
                constructor(family: string, _source: ArrayBuffer, descriptors: FontFaceDescriptors = {}) {
                    this.family = family;
                    this.featureSettings = descriptors.featureSettings || 'normal';
                }
                load = () => Promise.resolve(this);
            };
            server.respondWith(/\.ttf$/, function (request) { request.respond(200, undefined, 'font file'); });
        }

        afterEach(() => {
            delete (globalThis as any).FontFace;
        });

        test('caches vertical glyphs without drawing or downloading the same glyph twice', async () => {
            stubFontFaces();
            const drawn: string[] = [];
            const createRasterizer = vi.fn((options: TinySDFOptions, padding: number) => ({
                buffer: padding,
                draw(text: string) {
                    const vertical = options.fontFamily.includes('-vertical');
                    drawn.push(`${vertical ? 'vertical' : 'horizontal'}:${text}`);
                    return {
                        data: new Uint8ClampedArray(16).fill(vertical && text === 'ー' ? 200 : 100),
                        width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                        glyphLeft: vertical && text === '（' ? 8 : 0, glyphTop: 2, glyphAdvance: 48
                    };
                }
            }));
            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({Noto: 'https://localhost/noto.ttf'});
            const text = ['ー', '（', '京'];
            const request = {Noto: {normal: text, vertical: text}};

            const [first, concurrent] = await Promise.all([manager.getGlyphs(request), manager.getGlyphs(request)]);
            const cached = await manager.getGlyphs(request);

            expect(drawn).toHaveLength(6);
            expect(new Set(drawn).size).toBe(6);
            for (const char of text) {
                expect(first.Noto.normal[char].bitmap.data[0]).toBe(100);
                expect(cached.Noto.vertical[char]).toEqual(first.Noto.vertical[char]);
                expect(concurrent.Noto.normal[char].bitmap.data).not.toBe(first.Noto.normal[char].bitmap.data);
            }
            expect(first.Noto.vertical['ー'].bitmap.data[0]).toBe(200);
            expect(first.Noto.vertical['（'].metrics.left).toBe(4.5);
            expect(first.Noto.vertical['京']).toBeNull();
            expect(concurrent.Noto.vertical['ー'].bitmap.data).not.toBe(first.Noto.vertical['ー'].bitmap.data);
            expect(server.requests.map(request => request.url)).toEqual(['https://localhost/noto.ttf']);

            manager.setFontFaces({Noto: 'https://localhost/other.ttf'});
            await manager.getGlyphs(request);
            expect(drawn).toHaveLength(12);
        });

        test.each([false, true])('discards unchanged vertical glyphs (normal also requested: %s)', async (normalRequested) => {
            stubFontFaces();
            const draw = vi.fn(function (_text: string) {
                return {
                    data: new Uint8ClampedArray(16).fill(100),
                    width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                    glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
                };
            });
            const createRasterizer = fakeRasterizer(draw);
            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({Noto: 'https://localhost/noto.ttf'});
            const graphemes = ['京', 'か\u3099', '㍍', 'A', 'ー', '、\u0301', '∑', '\u0D4E（'];
            const request = {Noto: {normal: normalRequested ? graphemes : [], vertical: graphemes}};

            const glyphs = await manager.getGlyphs(request);

            for (const key of graphemes) expect(glyphs.Noto.vertical[key]).toBeNull();
            expect(draw.mock.calls.map(([text]) => text).sort()).toEqual(graphemes.flatMap(text => [text, text]).sort());
            await expect(manager.getGlyphs(request)).resolves.toEqual(glyphs);
            expect(draw).toHaveBeenCalledTimes(2 * graphemes.length);
            expect(server.requests.map(request => request.url)).toEqual(['https://localhost/noto.ttf']);
        });

        test('keeps NUL-prefixed text distinct from a vertical glyph for the following spacing mark', async () => {
            stubFontFaces();
            const drawn: Array<[string, boolean]> = [];
            function createRasterizer(options: TinySDFOptions, padding: number) {
                const vertical = options.fontFamily.includes('-vertical');
                return {
                    buffer: padding,
                    draw(text: string) {
                        drawn.push([text, vertical]);
                        return {
                            data: new Uint8ClampedArray(16).fill(vertical ? 200 : 100),
                            width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                            glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
                        };
                    }
                };
            }
            const manager = createGlyphManager(false, undefined, undefined, createRasterizer);
            manager.setFontFaces({Noto: 'https://localhost/noto.ttf'});
            const text = '\0\u093E';
            const request = {Noto: {normal: toGraphemes(text), vertical: ['\u093E']}};

            const [glyphs, concurrent] = await Promise.all([manager.getGlyphs(request), manager.getGlyphs(request)]);

            expect(Object.keys(glyphs.Noto.normal)).toEqual([text]);
            expect(Object.keys(glyphs.Noto.vertical)).toEqual(['\u093E']);
            expect(glyphs.Noto.normal[text].bitmap.data[0]).toBe(100);
            expect(glyphs.Noto.vertical['\u093E'].bitmap.data[0]).toBe(200);
            expect(drawn).toEqual(expect.arrayContaining([[text, false], ['\u093E', true], ['\u093E', false]]));
            expect(drawn).toHaveLength(3);
            expect(concurrent).toEqual(glyphs);
            await expect(manager.getGlyphs(request)).resolves.toEqual(glyphs);
            expect(drawn).toHaveLength(3);
        });

        test.each([false, true])('keeps PBF glyphs out of font-face comparisons (range requested first: %s)', async (rangeFirst) => {
            stubFontFaces();
            serveGlyphRanges();
            const draw = vi.fn(function (_text: string) {
                return {
                    data: new Uint8ClampedArray(16).fill(100),
                    width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                    glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
                };
            });
            const manager = createGlyphManager(true, undefined, undefined, fakeRasterizer(draw));
            manager.setFontFaces({Noto: [{url: 'https://localhost/noto.ttf', 'unicode-range': ['U+0028']}]});
            const request = {Noto: {normal: ['('], vertical: ['(']}};

            if (rangeFirst) await manager.getGlyphs({Noto: {normal: ['A'], vertical: []}});
            const glyphs = await manager.getGlyphs(request);
            if (!rangeFirst) await manager.getGlyphs({Noto: {normal: ['A'], vertical: []}});

            expect(glyphs.Noto.normal['('].metrics.isDoubleResolution).toBe(true);
            expect(glyphs.Noto.vertical['(']).toBeNull();
            await expect(manager.getGlyphs(request)).resolves.toEqual(glyphs);
            expect(draw).toHaveBeenCalledTimes(2);
            expect(glyphRangeRequests()).toHaveLength(1);
        });

        test.each([false, true])('leaves PBF vertical variants unavailable (font-faces declared: %s)', async (declared) => {
            stubFontFaces();
            serveGlyphRanges();
            const manager = createGlyphManager(true);
            if (declared) manager.setFontFaces({Noto: [{url: 'https://localhost/noto.ttf', 'unicode-range': ['U+3000-30FF']}]});

            const glyphs = await manager.getGlyphs({Noto: {normal: ['7'], vertical: ['7']}});

            expect(glyphs.Noto.normal['7'].metrics.advance).toBe(12);
            expect(glyphs.Noto.vertical).toEqual(declared ? {'7': null} : {});
            expect(server.requests.map(request => request.url)).toEqual(['https://localhost/fonts/v1/Noto/0-255.pbf']);
        });

        test.each(['vertical', 'horizontal'])('discards vertical glyphs when font faces change while awaiting the %s rasterizer', async (orientation) => {
            stubFontFaces();
            let finishLoad: () => void;
            let notifyStarted: () => void;
            const pendingLoad = new Promise<void>(resolve => { finishLoad = resolve; });
            const started = new Promise<void>(resolve => { notifyStarted = resolve; });
            const load = vi.spyOn(document.fonts, 'load').mockImplementation(function (font) {
                if ((font.includes('-vertical') ? 'vertical' : 'horizontal') !== orientation) return Promise.resolve([]);
                notifyStarted();
                return pendingLoad.then(() => []);
            });
            const draw = vi.fn(function (family: string, _text: string) {
                return {
                    data: new Uint8ClampedArray(16).fill(family.includes('-vertical') ? 200 : 100),
                    width: 4, height: 4, glyphWidth: 2, glyphHeight: 2,
                    glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
                };
            });
            function createRasterizer(options: TinySDFOptions, padding: number) {
                return {buffer: padding, draw(text: string) { return draw(options.fontFamily, text); }};
            }
            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({Noto: 'https://localhost/noto.ttf'});

            const stale = manager.getGlyphs({Noto: {normal: [], vertical: ['ー']}});
            await started;
            manager.setFontFaces({Noto: 'https://localhost/other.ttf'});
            finishLoad();

            expect((await stale).Noto.vertical['ー']).toBeNull();
            const staleDraws = orientation === 'horizontal' ? 1 : 0;
            expect(draw).toHaveBeenCalledTimes(staleDraws);
            expect(server.requests.some(request => request.url.endsWith('/other.ttf'))).toBe(false);
            const current = await manager.getGlyphs({Noto: {normal: ['ー'], vertical: ['ー']}});
            expect(current.Noto.normal['ー'].bitmap.data[0]).toBe(100);
            expect(current.Noto.vertical['ー'].bitmap.data[0]).toBe(200);
            expect(draw).toHaveBeenCalledTimes(staleDraws + 2);
            load.mockRestore();
        });

        test('rejects empty vertical substitutions while retaining the original glyph', async () => {
            stubFontFaces();
            const createRasterizer = vi.fn(function (options: TinySDFOptions, padding: number) {
                const vertical = options.fontFamily.includes('-vertical');
                return {
                    buffer: padding,
                    draw() {
                        return {
                            data: new Uint8ClampedArray(144).fill(vertical ? 0 : 100),
                            width: 12, height: 12, glyphWidth: vertical ? 0 : 2, glyphHeight: vertical ? 0 : 2,
                            glyphLeft: 0, glyphTop: 2, glyphAdvance: 48
                        };
                    }
                };
            });
            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({Noto: 'https://localhost/noto.ttf'});
            const request = {Noto: {normal: ['ー'], vertical: ['ー']}};

            const glyphs = await manager.getGlyphs(request);

            expect(glyphs.Noto.normal['ー'].bitmap.data[0]).toBe(100);
            expect(glyphs.Noto.vertical['ー']).toBeNull();
            expect((await manager.getGlyphs(request)).Noto.vertical['ー']).toBeNull();
            expect(createRasterizer).toHaveBeenCalledTimes(2);
        });

        test('draws a covered codepoint with the declared font file instead of downloading a range', async () => {
            stubFontFaces();
            serveGlyphRanges();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]});

            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x1780)], vertical: []}});

            expect(returnedGlyphs['Arial Unicode MS'].normal[char(0x1780)]).toBeDefined();
            expect(glyphRangeRequests()).toHaveLength(0);
            expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({
                fontFamily: expect.stringMatching(/^maplibre-gl-font-face-\d+,sans-serif$/)
            }), expect.any(Number));
        });

        test('draws a grapheme cluster as one glyph, from the file covering the letter it starts with', async () => {
            stubFontFaces();
            serveGlyphRanges();
            const drawn: string[] = [];
            const createRasterizer = fakeRasterizer((text) => { drawn.push(text); return GLYPHS[0]; });

            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/hebrew.ttf'});

            const shinWithShevaAndDot = '\u05E9\u05B0\u05C1';
            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [shinWithShevaAndDot], vertical: []}});

            expect(returnedGlyphs['Arial Unicode MS'].normal[shinWithShevaAndDot]).toBeDefined();
            expect(drawn).toContain(shinWithShevaAndDot);
            expect(glyphRangeRequests()).toHaveLength(0);
        });

        test('draws only the normal variant of an uncovered cluster from local fonts', async () => {
            stubFontFaces();
            serveGlyphRanges();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(true, undefined, undefined, createRasterizer);
            const khmerOnly = [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}];
            manager.setFontFaces({'Arial Unicode MS': khmerOnly});

            const shinWithShevaAndDot = '\u05E9\u05B0\u05C1';
            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {
                normal: [shinWithShevaAndDot], vertical: [shinWithShevaAndDot]
            }});

            expect(returnedGlyphs['Arial Unicode MS'].normal[shinWithShevaAndDot]).not.toBeNull();
            expect(returnedGlyphs['Arial Unicode MS'].vertical[shinWithShevaAndDot]).toBeNull();
            expect(createRasterizer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
                fontFamily: 'Arial Unicode MS,sans-serif'
            }), expect.any(Number));
            expect(server.requests).toHaveLength(0);
        });

        test('leaves a codepoint outside every declared range to the glyphs URL', async () => {
            stubFontFaces();
            serveGlyphRanges();

            const manager = createGlyphManager(true);
            manager.setFontFaces({'Arial Unicode MS': [{url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]});

            const returnedGlyphs = await manager.getGlyphs({'Arial Unicode MS': {normal: [char(55)], vertical: []}});

            expect(returnedGlyphs['Arial Unicode MS'].normal[char(55)].metrics.advance).toBe(12);
            expect(glyphRangeRequests()).toHaveLength(1);
        });

        test('does not sniff a weight or a style out of the font name, which the file already carries', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Noto Sans Bold Italic': 'https://localhost/noto-bold-italic.ttf'});
            await manager.getGlyphs({'Noto Sans Bold Italic': {normal: [char(0x41)], vertical: []}});

            expect(createRasterizer).toHaveBeenCalledWith(expect.objectContaining({fontWeight: undefined, fontStyle: 'normal'}), expect.any(Number));
        });

        test('keeps one TinySDF per declared file so a fallback cannot bleed into the rest of the text', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': [
                {url: 'https://localhost/khmer.ttf', 'unicode-range': ['U+1780-17FF']},
                {url: 'https://localhost/devanagari.ttf', 'unicode-range': ['U+0900-097F']}
            ]});

            await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x1780), char(0x1781), char(0x0915)], vertical: []}});

            const families = createRasterizer.mock.calls.map(([options]) => options.fontFamily);
            expect(new Set(families).size).toBe(2);
        });

        test('redraws with the new font faces rather than serving the glyphs cached from the old ones', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/noto.ttf'});
            await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x41)], vertical: []}});

            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/other.ttf'});
            await manager.getGlyphs({'Arial Unicode MS': {normal: [char(0x41)], vertical: []}});

            const families = createRasterizer.mock.calls.map(([options]) => options.fontFamily);
            expect(families).toHaveLength(2);
            expect(families[0]).not.toBe(families[1]);
        });

        test('gives a Burmese syllable, drawn nearly twice as wide as one character, a canvas it is not cut off by', async () => {
            stubFontFaces();
            const createRasterizer = fakeRasterizer();

            const manager = createGlyphManager(false, undefined, undefined, createRasterizer);
            manager.setFontFaces({'Arial Unicode MS': 'https://localhost/myanmar.ttf'});

            await manager.getGlyphs({'Arial Unicode MS': {normal: ['\u101C\u102C\u1038', char(0x41)], vertical: []}});

            const buffers = createRasterizer.mock.calls.map(([options]) => options.buffer);
            expect(Math.max(...buffers)).toBeGreaterThan(Math.min(...buffers));
        });
    });
});
