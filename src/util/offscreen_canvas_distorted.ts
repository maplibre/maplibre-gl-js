import {offscreenCanvasSupported} from './offscreen_canvas_supported';

let manglesOffscreenCanvas: boolean;

export function isOffscreenCanvasDistorted(): boolean {
    if (manglesOffscreenCanvas == null) {
        manglesOffscreenCanvas = false;
        // browser can mangle canvas#getImageData results when enhanced privacy protectsion are enabled (see #3185)
        if (offscreenCanvasSupported()) {
            const size = 5;
            const canvas = new OffscreenCanvas(size, size);
            const context = canvas.getContext('2d', {willReadFrequently: true});
            if (context) {
                for (let i = 0; i < size * size; i++) {
                    const base = i * 4;
                    context.fillStyle = `rgb(${base},${base + 1},${base + 2})`;
                    context.fillRect(i % size, Math.floor(i / size), 1, 1);
                }
                const data = context.getImageData(0, 0, size, size).data;
                for (let i = 0; i < size * size * 4; i++) {
                    if (i % 4 !== 3 && data[i] !== i) {
                        manglesOffscreenCanvas = true;
                        break;
                    }
                }
            }
        }
    }

    return manglesOffscreenCanvas || false;
}
