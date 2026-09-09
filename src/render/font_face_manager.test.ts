import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {FontFaceManager} from './font_face_manager.ts';
import {RequestManager} from '../util/request_manager.ts';
import {sleep} from '../util/test/util.ts';

describe('FontFaceManager', () => {
    const requestManager = new RequestManager();

    let added: FontFace[];
    let deleted: FontFace[];
    let sources: ArrayBuffer[];
    let server: FakeServer;

    let urlsWithoutAFontFile: Set<string>;

    function requestedUrls(): string[] {
        return server.requests.map(function (request) { return request.url; });
    }

    function stubFontFace(load: () => Promise<unknown> = function () { return Promise.resolve(); }, supportsFeatureSettings = true) {
        (globalThis as any).FontFace = class {
            family: string;
            featureSettings: string;
            constructor(family: string, source: ArrayBuffer, descriptors: FontFaceDescriptors = {}) {
                sources.push(source);
                this.family = family;
                this.featureSettings = supportsFeatureSettings ? descriptors.featureSettings || 'normal' : 'normal';
            }
            load = load;
        };
    }

    function silenceWarnings() {
        vi.spyOn(console, 'warn').mockImplementation(function () {});
    }

    beforeEach(() => {
        added = [];
        deleted = [];
        sources = [];
        urlsWithoutAFontFile = new Set();
        global.fetch = null;
        server = fakeServer.create({autoRespond: true, autoRespondAfter: 0});
        server.respondWith(function (request) {
            if (urlsWithoutAFontFile.has(request.url)) request.respond(404, undefined, 'Not Found');
            else request.respond(200, undefined, 'font file');
        });
        stubFontFace();
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                add(face: FontFace) { added.push(face); },
                delete(face: FontFace) { deleted.push(face); }
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        server.restore();
        delete (globalThis as any).FontFace;
        delete (document as any).fonts;
    });

    test('reports whether the style declared anything', () => {
        const manager = new FontFaceManager(requestManager);
        expect(manager.hasFontFaces()).toBe(false);

        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        expect(manager.hasFontFaces()).toBe(true);

        manager.setFontFaces(null);
        expect(manager.hasFontFaces()).toBe(false);
    });

    test('registers a font file under a family of its own, so the style cannot restyle the page', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});

        const family = await manager.getFontFamily('Noto Sans Regular', 0x41, false);

        expect(family).toMatch(/^maplibre-gl-font-face-\d+$/);
        expect(family).not.toBe('Noto Sans Regular');
        expect(added).toHaveLength(1);
        expect(added[0].family).toBe(family);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);
    });

    test('downloads a file only once, and only once a codepoint needs it', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]
        });

        expect(requestedUrls()).toEqual([]);

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        expect(requestedUrls()).toEqual([]);

        const [first, second] = await Promise.all([
            manager.getFontFamily('Noto Sans Regular', 0x1780, false),
            manager.getFontFamily('Noto Sans Regular', 0x1781, false)
        ]);

        expect(first).toBe(second);
        expect(requestedUrls()).toEqual(['https://example.com/khmer.ttf']);
    });

    test('picks the file whose unicode range covers the codepoint', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [
                {url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']},
                {url: 'https://example.com/devanagari.ttf', 'unicode-range': ['U+0900-097F']}
            ]
        });

        await manager.getFontFamily('Noto Sans Regular', 0x1780, false);
        await manager.getFontFamily('Noto Sans Regular', 0x0915, false);

        expect(requestedUrls()).toEqual(['https://example.com/khmer.ttf', 'https://example.com/devanagari.ttf']);
    });

    test.each([false, true])('shares one download between concurrent orientations (vertical first: %s)', async (verticalFirst) => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: [{url: 'https://example.com/noto.ttf', 'unicode-range': ['U+3000-30FF']}]});

        await expect(manager.getFontFamily('Noto', 0x41, true)).resolves.toBeNull();
        expect(requestedUrls()).toEqual([]);

        const families = await Promise.all([
            manager.getFontFamily('Noto', 0x30FC, verticalFirst),
            manager.getFontFamily('Noto', 0x3041, !verticalFirst),
            manager.getFontFamily('Noto', 0x30FC, true)
        ]);
        const vertical = families[verticalFirst ? 0 : 1];
        const horizontal = families[verticalFirst ? 1 : 0];
        expect(families[2]).toBe(vertical);
        expect(vertical).toBe(`${horizontal}-vertical`);
        expect(added).toHaveLength(2);
        expect(added[0]).toMatchObject({family: horizontal, featureSettings: 'normal'});
        expect(added[1]).toMatchObject({family: vertical, featureSettings: '"vert" 1'});
        expect(sources[0]).toBe(sources[1]);
        await expect(manager.getFontFamily('Noto', 0x30FC, true)).resolves.toBe(vertical);
        await expect(manager.getFontFamily('Noto', 0x30FC, false)).resolves.toBe(horizontal);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);

        manager.setFontFaces({Noto: 'https://example.com/other.ttf'});
        expect(deleted).toEqual(added);
        await expect(manager.getFontFamily('Noto', 0x30FC, true)).resolves.not.toBe(vertical);
        manager.destroy();
        expect(deleted).toEqual(added);
    });

    test('releases downloaded bytes after a normal-only load', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: 'https://example.com/noto.ttf'});

        const horizontal = await manager.getFontFamily('Noto', 0x30FC, false);
        expect(added).toHaveLength(1);
        const vertical = await manager.getFontFamily('Noto', 0x30FC, true);

        expect(vertical).toBe(`${horizontal}-vertical`);
        expect(sources[0]).not.toBe(sources[1]);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf', 'https://example.com/noto.ttf']);
    });

    test.each(['download', 'decode'])('uses the same fallback face after the primary %s fails', async (failure) => {
        silenceWarnings();
        let primaryRequests = 0;
        server.respondWith('GET', 'https://example.com/primary.ttf', function (request) {
            primaryRequests++;
            request.respond(failure === 'download' && primaryRequests === 1 ? 404 : 200, undefined, 'font file');
            return true;
        });
        let normalLoads = 0;
        stubFontFace(function (this: FontFace) {
            if (failure === 'decode' && this.featureSettings === 'normal' && ++normalLoads === 1) {
                return Promise.reject(new Error('invalid font'));
            }
            return Promise.resolve();
        });
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: [
            {url: 'https://example.com/primary.ttf'}, {url: 'https://example.com/fallback.ttf'}
        ]});

        const [horizontal, vertical] = await Promise.all([
            manager.getFontFamily('Noto', 0x30FC, false),
            manager.getFontFamily('Noto', 0x30FC, true)
        ]);

        expect(horizontal).not.toBeNull();
        expect(vertical).toBe(`${horizontal}-vertical`);
        await expect(manager.getFontFamily('Noto', 0x3041, true)).resolves.toBe(vertical);
        expect(requestedUrls()).toEqual(['https://example.com/primary.ttf', 'https://example.com/fallback.ttf']);
        expect(sources.at(-1)).toBe(sources.at(-2));
    });

    test('keeps the horizontal face usable when vertical settings fail to load', async () => {
        silenceWarnings();
        stubFontFace(function (this: FontFace) {
            return this.featureSettings === 'normal' ? Promise.resolve() : Promise.reject(new Error('unsupported settings'));
        });
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: [
            {url: 'https://example.com/noto.ttf'},
            {url: 'https://example.com/fallback.ttf'}
        ]});

        await expect(manager.getFontFamily('Noto', 0x30FC, true)).resolves.toBeNull();
        expect(added).toHaveLength(2);
        expect(deleted).toEqual([added[1]]);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);

        const horizontal = await manager.getFontFamily('Noto', 0x30FC, false);
        expect(horizontal).toBe(added[0].family);
        expect(added[0].featureSettings).toBe('normal');
        expect(added).toHaveLength(2);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);
        expect(console.warn).toHaveBeenCalledWith('Ignoring the vertical font face at https://example.com/noto.ttf: unsupported settings');
    });

    test('skips vertical faces for the whole declaration when the browser ignores feature settings', async () => {
        stubFontFace(undefined, false);
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: 'https://example.com/noto.ttf'});

        await expect(manager.getFontFamily('Noto', 0x30FC, true)).resolves.toBeNull();
        await expect(manager.getFontFamily('Noto', 0x3041, true)).resolves.toBeNull();
        expect(added).toHaveLength(1);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);

        const horizontal = await manager.getFontFamily('Noto', 0x30FC, false);
        expect(horizontal).toBe(added[0].family);
        expect(added).toHaveLength(1);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf']);
    });

    test('discards a vertical face that finishes loading after the manager is destroyed', async () => {
        let finishLoad: () => void;
        let notifyStarted: () => void;
        const pendingLoad = new Promise<void>(resolve => { finishLoad = resolve; });
        const started = new Promise<void>(resolve => { notifyStarted = resolve; });
        stubFontFace(function (this: FontFace) {
            if (this.featureSettings === 'normal') return Promise.resolve();
            notifyStarted();
            return pendingLoad;
        });
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Noto: 'https://example.com/noto.ttf'});

        const family = manager.getFontFamily('Noto', 0x30FC, true);
        await started;
        manager.destroy();
        finishLoad();

        await expect(family).resolves.toBeNull();
        expect(deleted).toEqual(added);
    });

    test('reads the unicode range grammar that CSS uses', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            Single: [{url: 'https://example.com/single.ttf', 'unicode-range': ['U+A5']}],
            Explicit: [{url: 'https://example.com/explicit.ttf', 'unicode-range': ['u+1780-17ff']}],
            Wildcard: [{url: 'https://example.com/wildcard.ttf', 'unicode-range': ['U+4??']}],
            PastTheEnd: [{url: 'https://example.com/past-the-end.ttf', 'unicode-range': ['U+??????']}]
        });

        await expect(manager.getFontFamily('Single', 0xa5, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Single', 0xa6, false)).resolves.toBeNull();

        await expect(manager.getFontFamily('Explicit', 0x1780, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Explicit', 0x1800, false)).resolves.toBeNull();

        await expect(manager.getFontFamily('Wildcard', 0x400, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Wildcard', 0x4ff, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Wildcard', 0x500, false)).resolves.toBeNull();

        await expect(manager.getFontFamily('PastTheEnd', 0x10ffff, false)).resolves.not.toBeNull();
    });

    test('honours every range of a multi-range font face', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            Unifont: [{url: 'https://example.com/unifont.ttf', 'unicode-range': ['U+0900-097F', 'U+1780-17FF']}]
        });

        await expect(manager.getFontFamily('Unifont', 0x0915, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x1790, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x41, false)).resolves.toBeNull();
    });

    test('covers every codepoint when no unicode range is given', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({Unifont: 'https://example.com/unifont.ttf'});

        await expect(manager.getFontFamily('Unifont', 0, false)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x10ffff, false)).resolves.not.toBeNull();
    });

    test('walks the font stack in order, giving the next name a turn only where the one before does not cover the codepoint', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}],
            'Noto Sans Italic': 'https://example.com/italic.ttf'
        });

        await manager.getFontFamily('Noto Sans Regular,Noto Sans Italic', 0x41, false);
        await manager.getFontFamily('Noto Sans Regular,Noto Sans Italic', 0x1780, false);

        expect(requestedUrls()).toEqual(['https://example.com/italic.ttf', 'https://example.com/khmer.ttf']);
    });

    test('leaves a codepoint no font face covers to the caller', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        await expect(manager.getFontFamily('Some Other Font', 0x1780, false)).resolves.toBeNull();
    });

    test('ignores a file that fails to download, falling through to the next one', async () => {
        silenceWarnings();
        urlsWithoutAFontFile.add('https://example.com/urlsWithoutAFontFile.ttf');

        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/urlsWithoutAFontFile.ttf'}, {url: 'https://example.com/noto.ttf'}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.not.toBeNull();
        expect(added).toHaveLength(1);
        expect(requestedUrls()).toEqual(['https://example.com/urlsWithoutAFontFile.ttf', 'https://example.com/noto.ttf']);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('404'));
    });

    test('ignores a font the browser refuses to decode, taking it back out of the document', async () => {
        silenceWarnings();
        stubFontFace(function () { return Promise.reject(new Error('could not be loaded')); });

        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/not-a-font.txt'});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        expect(deleted).toEqual(added);
    });

    test('ignores a declaration without a URL', async () => {
        silenceWarnings();
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': [{'unicode-range': ['U+0-10FFFF']} as any]});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('it has no URL'));
    });

    test('drops an unparseable unicode range but keeps the rest', async () => {
        silenceWarnings();
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{
                url: 'https://example.com/khmer.ttf',
                'unicode-range': ['0-255', 'U+', 'U+1234567', 'U+4??-U+5??', 'U+17FF-1780', 'U+FFFFFF', 'U+1780-17FF']
            }]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        await expect(manager.getFontFamily('Noto Sans Regular', 0x1780, false)).resolves.not.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('U+1234567'));
    });

    test('ignores a face whose every unicode range is unparseable', async () => {
        silenceWarnings();
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['nonsense']}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x1780, false)).resolves.toBeNull();
        expect(requestedUrls()).toEqual([]);
    });

    test('gives up when the environment has no CSS Font Loading API', async () => {
        silenceWarnings();
        delete (globalThis as any).FontFace;

        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41, false)).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CSS Font Loading API'));
    });

    test('does not register a font face that was replaced while its file was downloading', async () => {
        server.autoRespond = false;
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        const staleFamily = manager.getFontFamily('Noto Sans Regular', 0x41, false);
        await sleep(0);

        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/other.ttf'});
        server.respond();

        await expect(staleFamily).resolves.toBeNull();
        expect(added).toHaveLength(0);

        const familyPromise = manager.getFontFamily('Noto Sans Regular', 0x41, false);
        await sleep(0);
        server.respond();
        const family = await familyPromise;
        expect(added).toHaveLength(1);
        expect(added[0].family).toBe(family);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf', 'https://example.com/other.ttf']);
    });

    test('hands the font faces back when they are replaced, and again on destroy', async () => {
        const manager = new FontFaceManager(requestManager);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        await manager.getFontFamily('Noto Sans Regular', 0x41, false);

        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/other.ttf'});
        expect(deleted).toEqual(added);

        const family = await manager.getFontFamily('Noto Sans Regular', 0x41, false);
        expect(added).toHaveLength(2);
        expect(added[1].family).toBe(family);
        expect(requestedUrls()).toEqual(['https://example.com/noto.ttf', 'https://example.com/other.ttf']);

        manager.destroy();
        expect(deleted).toEqual(added);
        expect(manager.hasFontFaces()).toBe(false);
    });
});
