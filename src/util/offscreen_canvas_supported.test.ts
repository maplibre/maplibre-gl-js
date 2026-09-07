import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

describe('offscreenCanvasSupported', () => {
    /** Stands in for a browser whose `OffscreenCanvas` opens a 2d context. */
    function OffscreenCanvasWith2dContext() {
        return {getContext: () => ({})};
    }

    /** Stands in for a browser that has an `OffscreenCanvas` but refuses a 2d context on it. */
    function OffscreenCanvasWithout2dContext() {
        return {getContext: () => null};
    }

    /**
     * Re-imports the module so the probe result, which is cached in module scope, is thrown away
     * and the probe runs again against the globals the test installed.
     */
    async function importFreshProbe() {
        vi.resetModules();
        return (await import('./offscreen_canvas_supported.ts')).offscreenCanvasSupported;
    }

    beforeEach(() => {
        // The probe only checks that this is a function; nothing awaits what it returns.
        vi.stubGlobal('createImageBitmap', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    test('is supported when the browser opens a 2d context on an OffscreenCanvas', async () => {
        vi.stubGlobal('OffscreenCanvas', OffscreenCanvasWith2dContext);

        const offscreenCanvasSupported = await importFreshProbe();

        expect(offscreenCanvasSupported()).toBe(true);
    });

    test('is not supported when the browser has no OffscreenCanvas', async () => {
        vi.stubGlobal('OffscreenCanvas', undefined);

        const offscreenCanvasSupported = await importFreshProbe();

        expect(offscreenCanvasSupported()).toBe(false);
    });

    test('is not supported when the OffscreenCanvas has no 2d context', async () => {
        vi.stubGlobal('OffscreenCanvas', OffscreenCanvasWithout2dContext);

        const offscreenCanvasSupported = await importFreshProbe();

        expect(offscreenCanvasSupported()).toBe(false);
    });

    test('is not supported when the browser cannot create image bitmaps', async () => {
        vi.stubGlobal('OffscreenCanvas', OffscreenCanvasWith2dContext);
        vi.stubGlobal('createImageBitmap', undefined);

        const offscreenCanvasSupported = await importFreshProbe();

        expect(offscreenCanvasSupported()).toBe(false);
    });

    test('probes the browser only once when there is no 2d context', async () => {
        const getContext = vi.fn(() => null);
        vi.stubGlobal('OffscreenCanvas', function () {
            return {getContext};
        });

        const offscreenCanvasSupported = await importFreshProbe();
        offscreenCanvasSupported();
        offscreenCanvasSupported();

        expect(getContext).toHaveBeenCalledTimes(1);
    });
});
