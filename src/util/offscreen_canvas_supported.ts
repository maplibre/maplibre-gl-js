let supportsOffscreenCanvas: boolean;

/**
 * @returns true if the browser can rasterise into an `OffscreenCanvas`, false otherwise.
 *
 * The browser is probed once and the answer cached. The `getContext` result has to be coerced to a
 * boolean for that: it is null when there is no 2d context, and `??=` reads a cached null as
 * "not probed yet".
 */
export function offscreenCanvasSupported(): boolean {
    supportsOffscreenCanvas ??= typeof OffscreenCanvas !== 'undefined' &&
            !!new OffscreenCanvas(1, 1).getContext('2d') &&
            typeof createImageBitmap === 'function';

    return supportsOffscreenCanvas;
}
