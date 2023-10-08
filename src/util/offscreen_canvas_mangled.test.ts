import {offscreenCanvasMangled} from './offscreen_canvas_mangled';
import {Canvas} from 'canvas';
import {offscreenCanvasSupported} from './offscreen_canvas_supported';

test('normal operation does not mangle canvas', () => {
    const OffscreenCanvas = (window as any).OffscreenCanvas = jest.fn((width:number, height: number) => {
        return new Canvas(width, height);
    });
    expect(offscreenCanvasSupported()).toBeTruthy();
    OffscreenCanvas.mockClear();
    expect(offscreenCanvasMangled()).toBeFalsy();
    expect(OffscreenCanvas).toHaveBeenCalledTimes(1);
});
