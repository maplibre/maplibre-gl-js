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
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [8192, 8192], pixelRatio: 5});
        map.resize();
        expect(map.getCanvas().width).toBe(8192);
        expect(map.getCanvas().height).toBe(8192);
    });

    test('maxCanvasSize width != height', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 1024});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(4096);
        const map = createMap({container, maxCanvasSize: [8192, 4096], pixelRatio: 3});
        map.resize();
        expect(map.getCanvas().width).toBe(2048);
        expect(map.getCanvas().height).toBe(4096);
    });

    test('maxCanvasSize below clientWidth and clientHeight', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 12834});
        Object.defineProperty(container, 'clientHeight', {value: 9000});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(4096);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [4096, 8192], pixelRatio: 1});
        map.resize();
        expect(map.getCanvas().width).toBe(4096);
        expect(map.getCanvas().height).toBe(2872);
    });

    test('maxCanvasSize with setPixelRatio', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(3072);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(3072);
        const map = createMap({container, maxCanvasSize: [3072, 3072], pixelRatio: 1.25});
        map.resize();
        expect(map.getCanvas().width).toBe(2560);
        expect(map.getCanvas().height).toBe(2560);
        map.setPixelRatio(2);
        expect(map.getCanvas().width).toBe(3072);
        expect(map.getCanvas().height).toBe(3072);
    });
});
