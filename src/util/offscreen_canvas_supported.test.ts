import {describe, test, expect, afterEach, vi} from 'vitest';

describe('offscreenCanvasSupported', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    // The supported case is covered by `offscreen_canvas_distorted.test.ts`. This is the case that
    // used to re-probe on every call, because `getContext` returning null cached null rather than
    // false and `??=` read that as "not probed yet".
    test('answers false, and probes the browser only once, when the OffscreenCanvas has no 2d context', async () => {
        const getContext = vi.fn(() => null);
        vi.stubGlobal('OffscreenCanvas', function () {
            return {getContext};
        });
        // The probe only checks that this is a function; nothing awaits what it returns.
        vi.stubGlobal('createImageBitmap', vi.fn());

        // The probe caches its answer in module scope, so it has to be re-imported to run at all.
        vi.resetModules();
        const {offscreenCanvasSupported} = await import('./offscreen_canvas_supported.ts');

        expect(offscreenCanvasSupported()).toBe(false);
        expect(offscreenCanvasSupported()).toBe(false);
        expect(getContext).toHaveBeenCalledTimes(1);
    });
});
