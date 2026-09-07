let supportsOffscreenCanvas: boolean;

export function offscreenCanvasSupported(): boolean {
    // `getContext` returns null rather than false, which `??=` would read as "not probed yet".
    supportsOffscreenCanvas ??= typeof OffscreenCanvas !== 'undefined' &&
            !!new OffscreenCanvas(1, 1).getContext('2d') &&
            typeof createImageBitmap === 'function';

    return supportsOffscreenCanvas;
}
