import {offscreenCanvasMangled} from './offscreen_canvas_mangled';
import {Canvas} from 'canvas';

test('normal operation does not mangle canvas', () => {
    const OffscreenCanvas = (window as any).OffscreenCanvas = jest.fn((width:number, height: number) => {
        return new Canvas(width, height);
    });
    expect(offscreenCanvasMangled()).toBeFalsy();
    expect(OffscreenCanvas).toHaveBeenCalledTimes(2);
});
