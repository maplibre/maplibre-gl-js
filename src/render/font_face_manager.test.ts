import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {FontFaceManager, parseUnicodeRange} from './font_face_manager.ts';

import type {RequestManager} from '../util/request_manager.ts';

describe('parseUnicodeRange', () => {
    test('parses a single codepoint', () => {
        expect(parseUnicodeRange('U+A5')).toEqual({start: 0xa5, end: 0xa5});
    });

    test('parses an explicit range', () => {
        expect(parseUnicodeRange('U+0-10FFFF')).toEqual({start: 0, end: 0x10ffff});
        expect(parseUnicodeRange('u+1780-17ff')).toEqual({start: 0x1780, end: 0x17ff});
    });

    test('parses a wildcard range', () => {
        expect(parseUnicodeRange('U+4??')).toEqual({start: 0x400, end: 0x4ff});
        expect(parseUnicodeRange('U+??')).toEqual({start: 0, end: 0xff});
    });

    test('clamps a wildcard range that runs past the last codepoint', () => {
        expect(parseUnicodeRange('U+??????')).toEqual({start: 0, end: 0x10ffff});
    });

    test('rejects ranges it cannot make sense of', () => {
        expect(parseUnicodeRange('0-255')).toBeNull();
        expect(parseUnicodeRange('U+')).toBeNull();
        expect(parseUnicodeRange('U+1234567')).toBeNull();
        expect(parseUnicodeRange('U+4??-U+5??')).toBeNull();
        expect(parseUnicodeRange('U+17FF-1780')).toBeNull();
        expect(parseUnicodeRange('U+FFFFFF')).toBeNull();
    });
});

describe('FontFaceManager', () => {
    const identityTransform = ((url: string) => ({url})) as any as RequestManager;
    let added: FontFace[];
    let deleted: FontFace[];

    class FontFaceStub {
        family: string;
        source: ArrayBuffer;
        constructor(family: string, source: ArrayBuffer) {
            this.family = family;
            this.source = source;
        }
        load = vi.fn(() => Promise.resolve(this));
    }

    beforeEach(() => {
        added = [];
        deleted = [];
        (globalThis as any).FontFace = FontFaceStub;
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                add: (face: FontFace) => added.push(face),
                delete: (face: FontFace) => deleted.push(face)
            }
        });
        vi.spyOn(FontFaceManager, 'loadFontFile').mockResolvedValue(new ArrayBuffer(8));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (globalThis as any).FontFace;
        delete (document as any).fonts;
    });

    test('reports whether the style declared anything', () => {
        const manager = new FontFaceManager(identityTransform);
        expect(manager.hasFontFaces()).toBe(false);

        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        expect(manager.hasFontFaces()).toBe(true);

        manager.setFontFaces(null);
        expect(manager.hasFontFaces()).toBe(false);
    });

    test('registers a font file under a family of its own and returns it', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});

        const family = await manager.getFontFamily('Noto Sans Regular', 0x41);

        expect(family).toMatch(/^maplibre-gl-font-face-\d+$/);
        // The style's own font name must not leak into the page's typography.
        expect(family).not.toBe('Noto Sans Regular');
        expect(added).toHaveLength(1);
        expect(added[0].family).toBe(family);
        expect(FontFaceManager.loadFontFile).toHaveBeenCalledWith('https://example.com/noto.ttf', identityTransform);
    });

    test('does not download a file until a codepoint needs it', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]
        });

        expect(FontFaceManager.loadFontFile).not.toHaveBeenCalled();

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        expect(FontFaceManager.loadFontFile).not.toHaveBeenCalled();

        await expect(manager.getFontFamily('Noto Sans Regular', 0x1780)).resolves.not.toBeNull();
        expect(FontFaceManager.loadFontFile).toHaveBeenCalledTimes(1);
    });

    test('downloads each file once, however many codepoints it covers', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});

        const [first, second] = await Promise.all([
            manager.getFontFamily('Noto Sans Regular', 0x41),
            manager.getFontFamily('Noto Sans Regular', 0x42)
        ]);
        await manager.getFontFamily('Noto Sans Regular', 0x43);

        expect(first).toBe(second);
        expect(FontFaceManager.loadFontFile).toHaveBeenCalledTimes(1);
    });

    test('picks the file whose unicode range covers the codepoint', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [
                {url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']},
                {url: 'https://example.com/devanagari.ttf', 'unicode-range': ['U+0900-097F']}
            ]
        });

        await manager.getFontFamily('Noto Sans Regular', 0x1780);
        await manager.getFontFamily('Noto Sans Regular', 0x0915);

        expect(FontFaceManager.loadFontFile).toHaveBeenNthCalledWith(1, 'https://example.com/khmer.ttf', identityTransform);
        expect(FontFaceManager.loadFontFile).toHaveBeenNthCalledWith(2, 'https://example.com/devanagari.ttf', identityTransform);
    });

    test('honours every range of a multi-range font face', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            Unifont: [{url: 'https://example.com/unifont.ttf', 'unicode-range': ['U+0900-097F', 'U+1780-17FF']}]
        });

        await expect(manager.getFontFamily('Unifont', 0x0915)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x1790)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x41)).resolves.toBeNull();
    });

    test('covers every codepoint when no unicode range is given', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({Unifont: 'https://example.com/unifont.ttf'});

        await expect(manager.getFontFamily('Unifont', 0)).resolves.not.toBeNull();
        await expect(manager.getFontFamily('Unifont', 0x10ffff)).resolves.not.toBeNull();
    });

    test('walks the font stack in order, name by name', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}],
            'Noto Sans Italic': 'https://example.com/italic.ttf'
        });

        // The first name in the stack does not cover Latin, so the second one gets a turn.
        await manager.getFontFamily('Noto Sans Regular,Noto Sans Italic', 0x41);
        expect(FontFaceManager.loadFontFile).toHaveBeenCalledExactlyOnceWith('https://example.com/italic.ttf', identityTransform);

        // ...but it does cover Khmer, so the second one never comes up.
        await manager.getFontFamily('Noto Sans Regular,Noto Sans Italic', 0x1780);
        expect(FontFaceManager.loadFontFile).toHaveBeenLastCalledWith('https://example.com/khmer.ttf', identityTransform);
        expect(FontFaceManager.loadFontFile).toHaveBeenCalledTimes(2);
    });

    test('leaves a codepoint no font face covers to the caller', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['U+1780-17FF']}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        await expect(manager.getFontFamily('Some Other Font', 0x1780)).resolves.toBeNull();
    });

    test('ignores a file that fails to download, falling through to the next one', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(FontFaceManager.loadFontFile)
            .mockRejectedValueOnce(new Error('404 Not Found'))
            .mockResolvedValueOnce(new ArrayBuffer(8));

        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/missing.ttf'}, {url: 'https://example.com/noto.ttf'}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.not.toBeNull();
        expect(added).toHaveLength(1);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('404 Not Found'));
    });

    test('ignores a font the browser refuses to decode', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        (globalThis as any).FontFace = class extends FontFaceStub {
            load = vi.fn(() => Promise.reject(new Error('could not be loaded')));
        };

        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/not-a-font.txt'});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        // The unusable face must not be left behind in the document.
        expect(deleted).toEqual(added);
    });

    test('ignores a declaration without a URL', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': [{'unicode-range': ['U+0-10FFFF']} as any]});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('it has no URL'));
    });

    test('drops an unparseable unicode range but keeps the rest', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['nonsense', 'U+1780-17FF']}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        await expect(manager.getFontFamily('Noto Sans Regular', 0x1780)).resolves.not.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('nonsense'));
    });

    test('ignores a face whose every unicode range is unparseable', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({
            'Noto Sans Regular': [{url: 'https://example.com/khmer.ttf', 'unicode-range': ['nonsense']}]
        });

        await expect(manager.getFontFamily('Noto Sans Regular', 0x1780)).resolves.toBeNull();
        expect(FontFaceManager.loadFontFile).not.toHaveBeenCalled();
    });

    test('gives up when the environment has no CSS Font Loading API', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        delete (globalThis as any).FontFace;

        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});

        await expect(manager.getFontFamily('Noto Sans Regular', 0x41)).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CSS Font Loading API'));
    });

    test('hands the previous font faces back when they are replaced', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        await manager.getFontFamily('Noto Sans Regular', 0x41);

        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/other.ttf'});
        expect(deleted).toEqual(added);

        const family = await manager.getFontFamily('Noto Sans Regular', 0x41);
        expect(added).toHaveLength(2);
        expect(added[1].family).toBe(family);
        expect(FontFaceManager.loadFontFile).toHaveBeenLastCalledWith('https://example.com/other.ttf', identityTransform);
    });

    test('hands the font faces back on destroy', async () => {
        const manager = new FontFaceManager(identityTransform);
        manager.setFontFaces({'Noto Sans Regular': 'https://example.com/noto.ttf'});
        await manager.getFontFamily('Noto Sans Regular', 0x41);

        manager.destroy();

        expect(deleted).toEqual(added);
        expect(manager.hasFontFaces()).toBe(false);
    });
});
