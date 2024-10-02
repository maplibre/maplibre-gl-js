import {test, expect, vi} from 'vitest';
import {isOffscreenCanvasDistorted} from './offscreen_canvas_distorted';
import {Canvas} from 'canvas';
import {offscreenCanvasSupported} from './offscreen_canvas_supported';

test('normal operation does not mangle canvas', () => {
    const OffscreenCanvas = (window as any).OffscreenCanvas = vi.fn((width:number, height: number) => {
        return new Canvas(width, height);
    });
    expect(offscreenCanvasSupported()).toBeTruthy();
    OffscreenCanvas.mockClear();
    expect(isOffscreenCanvasDistorted()).toBeFalsy();
    expect(OffscreenCanvas).toHaveBeenCalledTimes(1);
});
