import {describe, test, expect, afterEach, vi} from 'vitest';

describe('offscreenCanvasSupported', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    test('answers false, and probes the browser only once, when the OffscreenCanvas has no 2d context', async () => {
        const getContext = vi.fn(() => null);
        vi.stubGlobal('OffscreenCanvas', function () {
            return {getContext};
        });
        vi.stubGlobal('createImageBitmap', vi.fn());

        const {offscreenCanvasSupported} = await import('./offscreen_canvas_supported.ts');

        expect(offscreenCanvasSupported()).toBe(false);
        expect(offscreenCanvasSupported()).toBe(false);
        expect(getContext).toHaveBeenCalledTimes(1);
    });
});
