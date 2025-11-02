import {test, expect, vi, describe, beforeEach} from 'vitest';
import {isOffscreenCanvasDistorted} from './offscreen_canvas_distorted';
import {Canvas} from 'canvas';
import {offscreenCanvasSupported} from './offscreen_canvas_supported';

describe('Offscreen canvas', () => {
    let OffscreenCanvasMock: any;
    beforeEach(() => {
        OffscreenCanvasMock = vi.fn(function (width:number, height: number) {
            return new Canvas(width, height);
        }) as any;
        global.OffscreenCanvas = OffscreenCanvasMock;
    });
    test('normal operation does not mangle canvas', () => {
        expect(offscreenCanvasSupported()).toBeTruthy();
    });

    test('distoreted is false by default', () => {
        expect(isOffscreenCanvasDistorted()).toBeFalsy();
        expect(OffscreenCanvasMock).toHaveBeenCalledTimes(1);
    });
});

