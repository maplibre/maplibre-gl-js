import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import type {isJXLSupported as detectJXL} from './jxl_supported.ts';

describe('JXL support', () => {
    let isJXLSupported: typeof detectJXL;

    beforeEach(async () => {
        vi.resetModules();
        ({isJXLSupported} = await import('./jxl_supported.ts'));
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test('shares the probe and caches successful decoding', async () => {
        const bitmap = {width: 1, height: 1, close: vi.fn()};
        const decode = vi.fn().mockResolvedValue(bitmap);
        vi.stubGlobal('createImageBitmap', decode);

        const pending = isJXLSupported();
        expect(isJXLSupported()).toBe(pending);
        await expect(pending).resolves.toBe(true);
        expect(isJXLSupported()).toBe(true);
        expect(decode).toHaveBeenCalledTimes(1);
        expect(bitmap.close).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('caches unsupported decoding', async () => {
        vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Unsupported image')));
        await expect(isJXLSupported()).resolves.toBe(false);
        expect(isJXLSupported()).toBe(false);
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
});
