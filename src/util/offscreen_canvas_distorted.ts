import {offscreenCanvasSupported} from './offscreen_canvas_supported';

let offscreenCanvasDistorted: boolean;

/**
 * Some browsers don't return the exact pixels from a canvas to prevent user fingerprinting (see #3185).
 * This function writes pixels to an OffscreenCanvas and reads them back using getImageData, returning false
 * if they don't match.
 *
 * @returns true if the browser supports OffscreenCanvas but it distorts getImageData results, false otherwise.
 */
export function isOffscreenCanvasDistorted(): boolean {
    if (offscreenCanvasDistorted == null) {
        offscreenCanvasDistorted = false;
        if (offscreenCanvasSupported()) {
            const size = 5;
            const canvas = new OffscreenCanvas(size, size);
            const context = canvas.getContext('2d', {willReadFrequently: true});
            if (context) {
                // fill each pixel with an RGB value that should make the byte at index i equal to i (except alpha channel):
                // [0, 1, 2, 255, 4, 5, 6, 255, 8, 9, 10, 255, ...]
                for (let i = 0; i < size * size; i++) {
                    const base = i * 4;
                    context.fillStyle = `rgb(${base},${base + 1},${base + 2})`;
                    context.fillRect(i % size, Math.floor(i / size), 1, 1);
                }
                const data = context.getImageData(0, 0, size, size).data;
                for (let i = 0; i < size * size * 4; i++) {
                    if (i % 4 !== 3 && data[i] !== i) {
                        offscreenCanvasDistorted = true;
                        break;
                    }
                }
            }
        }
    }

    return offscreenCanvasDistorted || false;
}
