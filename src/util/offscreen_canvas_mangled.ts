import {offscreenCanvasSupported} from './offscreen_canvas_supported';

let manglesOffscreenCanvas: boolean;

export function offscreenCanvasMangled(): boolean {
    if (manglesOffscreenCanvas == null) {
        manglesOffscreenCanvas = false;
        // browser can mangle canvas#getImageData results when enhanced privacy protectsion are enabled (see #85)
        if (offscreenCanvasSupported()) {
            const canvas = new OffscreenCanvas(10, 10);
            const context = canvas.getContext('2d');
            if (context) {
                const size = 10;
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        context.fillStyle = `rgb(${x},${y},${x + y})`;
                        context.fillRect(x, y, 1, 1);
                    }
                }
                const data = context.getImageData(0, 0, size, size).data;
                for (let i = 0; i < data.length; i += 4) {
                    const x = (i / 4) % size;
                    const y = Math.floor(i / 4 / size);
                    if (data[i] !== x || data[i + 1] !== y || data[i + 2] !== x + y) {
                        manglesOffscreenCanvas = true;
                        break;
                    }
                }
            }
        }
    }

    return manglesOffscreenCanvas || false;
}
