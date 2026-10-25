import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import type {isJXLSupported as detectJXL} from './jxl_supported.ts';

describe('JXL support', () => {
    let isJXLSupported: typeof detectJXL;
    let images: HTMLImageElement[];

    beforeEach(async () => {
        vi.resetModules();
        ({isJXLSupported} = await import('./jxl_supported.ts'));
        vi.useFakeTimers();
        images = [];
        vi.stubGlobal('createImageBitmap', undefined);
        const NativeImage = Image;
        vi.stubGlobal('Image', class extends NativeImage {
            constructor() {
                super();
                Object.defineProperties(this, {
                    naturalWidth: {value: 1},
                    naturalHeight: {value: 1}
                });
                images.push(this);
            }
        });
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:jxl-probe'),
            revokeObjectURL: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test('shares the bitmap probe and caches successful decoding', async () => {
        const bitmap = {width: 1, height: 1, close: vi.fn()};
        const decode = vi.fn().mockResolvedValue(bitmap);
        vi.stubGlobal('createImageBitmap', decode);
        // The bitmap backend must also work in workers without DOM image APIs.
        vi.stubGlobal('Image', undefined);

        const first = isJXLSupported();
        expect(isJXLSupported()).toBe(first);
        await expect(first).resolves.toBe(true);
        expect(isJXLSupported()).toBe(true);
        expect(decode).toHaveBeenCalledTimes(1);
        expect(decode.mock.calls[0][0]).toMatchObject({type: 'image/png', size: 23});
        expect(bitmap.close).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('caches bitmap decoding failures without trying a different backend', async () => {
        const decode = vi.fn().mockRejectedValue(new Error('Unsupported image'));
        vi.stubGlobal('createImageBitmap', decode);
        await expect(isJXLSupported()).resolves.toBe(false);
        expect(isJXLSupported()).toBe(false);
        expect(decode).toHaveBeenCalledTimes(1);
        expect(images).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('handles a synchronous decoder error', async () => {
        vi.stubGlobal('createImageBitmap', () => { throw new Error('Decoder unavailable'); });
        await expect(isJXLSupported()).resolves.toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('rejects unexpected image dimensions and closes the bitmap', async () => {
        const bitmap = {width: 0, height: 0, close: vi.fn()};
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
        await expect(isJXLSupported()).resolves.toBe(false);
        expect(bitmap.close).toHaveBeenCalledTimes(1);
    });

    test('times out and closes a bitmap returned late without changing the cached result', async () => {
        let finish: (bitmap: unknown) => void;
        vi.stubGlobal('createImageBitmap', () => new Promise(resolve => { finish = resolve; }));
        const pending = isJXLSupported();
        await vi.advanceTimersByTimeAsync(1000);
        await expect(pending).resolves.toBe(false);
        const bitmap = {width: 1, height: 1, close: vi.fn()};
        finish(bitmap);
        await Promise.resolve();
        expect(bitmap.close).toHaveBeenCalledTimes(1);
        expect(isJXLSupported()).toBe(false);
    });

    test.each(['load', 'error', 'timeout'] as const)('cleans up the image probe after %s', async (event) => {
        const pending = isJXLSupported();
        expect(isJXLSupported()).toBe(pending);
        expect(images).toHaveLength(1);
        if (event === 'timeout') {
            await vi.advanceTimersByTimeAsync(1000);
        } else {
            images[0].dispatchEvent(new Event(event));
        }
        await expect(pending).resolves.toBe(event === 'load');
        expect(isJXLSupported()).toBe(event === 'load');
        expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:jxl-probe');
        expect(images[0].hasAttribute('src')).toBe(false);
        expect(images[0].onload).toBeNull();
        expect(images[0].onerror).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('caches support separately for the two decoding backends', async () => {
        vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Unsupported image')));
        await expect(isJXLSupported()).resolves.toBe(false);
        vi.stubGlobal('createImageBitmap', undefined);
        const pending = isJXLSupported();
        images[0].dispatchEvent(new Event('load'));
        await expect(pending).resolves.toBe(true);
    });

    test('handles unavailable image APIs', async () => {
        vi.stubGlobal('Image', undefined);
        await expect(isJXLSupported()).resolves.toBe(false);
    });

    test('handles blocked object URLs', async () => {
        vi.mocked(URL.createObjectURL).mockImplementation(() => { throw new Error('Blocked'); });
        await expect(isJXLSupported()).resolves.toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });
});
