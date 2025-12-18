import {beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
});

test('does not fire "webglcontextlost" after remove has been called', () => {
    const map = createMap();
    const canvas = map.getCanvas();
    const spy = vi.fn();
    map.on('webglcontextlost', spy);
    map.remove();
    // Dispatch the event manually because at the time of this writing, gl does not support
    // the WEBGL_lose_context extension.
    canvas.dispatchEvent(new window.Event('webglcontextlost'));
    expect(spy).not.toHaveBeenCalled();
});

test('does not fire "webglcontextrestored" after remove has been called', async () => {
    const map = createMap();
    const canvas = map.getCanvas();

    const contextLostPromise =  map.once('webglcontextlost');

    // Dispatch the event manually because at the time of this writing, gl does not support
    // the WEBGL_lose_context extension.
    canvas.dispatchEvent(new window.Event('webglcontextlost'));

    await contextLostPromise;
    const spy = vi.fn();
    map.on('webglcontextrestored', spy);
    map.remove();
    canvas.dispatchEvent(new window.Event('webglcontextrestored'));
    expect(spy).not.toHaveBeenCalled();
});

test('WebGL error while creating map', () => {
    HTMLCanvasElement.prototype.getContext = function (type: string) {
        if (type === 'webgl2' || type === 'webgl') {
            const errorEvent = new Event('webglcontextcreationerror');
            (errorEvent as any).statusMessage = 'mocked webglcontextcreationerror message';
            (this as HTMLCanvasElement).dispatchEvent(errorEvent);
            return null;
        }
    };
    try {
        createMap();
    } catch (e) {
        const errorMessageObject = JSON.parse(e.message);

        // this message is from map code
        expect(errorMessageObject.message).toBe('Failed to initialize WebGL');

        // this is from test mock
        expect(errorMessageObject.statusMessage).toBe('mocked webglcontextcreationerror message');
    }
});

test('Check Map is being created with desired WebGL version', () => {
    HTMLCanvasElement.prototype.getContext = function (type: string) {
        const errorEvent = new Event('webglcontextcreationerror');
        (errorEvent as any).statusMessage = `${type} is not supported`;
        (this as HTMLCanvasElement).dispatchEvent(errorEvent);
        return null;
    };

    try {
        createMap({canvasContextAttributes: {contextType: 'webgl2'}});
    } catch (e) {
        const errorMessageObject = JSON.parse(e.message);
        expect(errorMessageObject.statusMessage).toBe('webgl2 is not supported');
    }
  
    try {
        createMap({canvasContextAttributes: {contextType: 'webgl'}});
    } catch (e) {
        const errorMessageObject = JSON.parse(e.message);
        expect(errorMessageObject.statusMessage).toBe('webgl is not supported');
    }

});

test('Check Map falls back to WebGL if WebGL 2 is not supported', () => {
    const mockGetContext = vi.fn().mockImplementation((type: string) => {
        if (type === 'webgl2') {return null;}
        return originalGetContext.apply(this, [type]);
    });
    HTMLCanvasElement.prototype.getContext = mockGetContext;
  
    try {
        createMap();
    } catch(_) { // eslint-disable-line @typescript-eslint/no-unused-vars
    }
    expect(mockGetContext).toHaveBeenCalledTimes(2);
    expect(mockGetContext.mock.calls[0][0]).toBe('webgl2');
    expect(mockGetContext.mock.calls[1][0]).toBe('webgl');
  
});

test('Hit WebGL max drawing buffer limit', () => {
    // Simulate a device with MAX_TEXTURE_SIZE=16834 and max rendering area of ~32Mpx
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 8000});
    Object.defineProperty(container, 'clientHeight', {value: 4500});
    const map = createMap({container, maxCanvasSize: [16834, 16834], pixelRatio: 1});
    vi.spyOn(map.painter.context.gl, 'drawingBufferWidth', 'get').mockReturnValue(7536);
    vi.spyOn(map.painter.context.gl, 'drawingBufferHeight', 'get').mockReturnValue(4239);
    map.resize();
    expect(map.getCanvas().width).toBe(7536);
    expect(map.getCanvas().height).toBe(4239);
    // Check if maxCanvasSize is updated
    expect(map._maxCanvasSize).toEqual([7536, 4239]);
});
