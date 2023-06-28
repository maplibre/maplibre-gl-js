let supportsOffscreenCanvas: boolean;

export function offscreenCanvasSupported(): boolean {
    if (supportsOffscreenCanvas == null) {
        supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined' &&
            new OffscreenCanvas(1, 1).getContext('2d') &&
            typeof createImageBitmap === 'function';
    }

    return supportsOffscreenCanvas;
}
