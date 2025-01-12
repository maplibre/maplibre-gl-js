import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Max Canvas Size option', () => {
    test('maxCanvasSize width = height', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [8192, 8192], pixelRatio: 5});
        map.resize();
        expect(map.getCanvas().width).toBe(8192);
        expect(map.getCanvas().height).toBe(8192);
    });

    test('maxCanvasSize width != height', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 1024});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(4096);
        const map = createMap({container, maxCanvasSize: [8192, 4096], pixelRatio: 3});
        map.resize();
        expect(map.getCanvas().width).toBe(2048);
        expect(map.getCanvas().height).toBe(4096);
    });

    test('maxCanvasSize below clientWidth and clientHeight', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 12834});
        Object.defineProperty(container, 'clientHeight', {value: 9000});
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(4096);
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [4096, 8192], pixelRatio: 1});
        map.resize();
        expect(map.getCanvas().width).toBe(4096);
        expect(map.getCanvas().height).toBe(2872);
    });

    test('maxCanvasSize with setPixelRatio', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(3072);
        vi.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(3072);
        const map = createMap({container, maxCanvasSize: [3072, 3072], pixelRatio: 1.25});
        map.resize();
        expect(map.getCanvas().width).toBe(2560);
        expect(map.getCanvas().height).toBe(2560);
        map.setPixelRatio(2);
        expect(map.getCanvas().width).toBe(3072);
        expect(map.getCanvas().height).toBe(3072);
    });
});

describe('WebGLContextAttributes options', () => {
    test('Optional values can be set correctly', () => {
        const container = window.document.createElement('div');
        const canvasContextAttributes = {
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: true,
            desynchronized: true,
        };
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        const map = createMap({container, canvasContextAttributes});
        const gl = map.painter.context.gl;
        const mapContextAttributes = gl.getContextAttributes();
        expect(mapContextAttributes.antialias).toBe(canvasContextAttributes.antialias);
        expect(mapContextAttributes.preserveDrawingBuffer).toBe(canvasContextAttributes.preserveDrawingBuffer);
        expect(mapContextAttributes.powerPreference).toBe(canvasContextAttributes.powerPreference);
        expect(mapContextAttributes.failIfMajorPerformanceCaveat).toBe(canvasContextAttributes.failIfMajorPerformanceCaveat);
        expect(mapContextAttributes.desynchronized).toBe(canvasContextAttributes.desynchronized);
    });

    test('Required values cannot be set', () => {
        const container = window.document.createElement('div');
        const canvasContextAttributes = {
            alpha: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
        };
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        const map = createMap({container, canvasContextAttributes});
        const mapContextAttributes = map.painter.context.gl.getContextAttributes();
        expect(mapContextAttributes.alpha).toBe(true);
        expect(mapContextAttributes.depth).toBe(true);
        expect(mapContextAttributes.stencil).toBe(true);
        expect(mapContextAttributes.premultipliedAlpha).toBe(true);
    });

});
