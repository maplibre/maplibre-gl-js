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

test('handles "webglcontextlost" when map is created without style', () => {
    // This test verifies fix for #7022 - map should not throw when WebGL context
    // is lost before the style is loaded (i.e., when style is null/undefined)
    const map = createMap({deleteStyle: true});
    const canvas = map.getCanvas();
    const spy = vi.fn();
    map.on('webglcontextlost', spy);
    // Dispatch the event manually because at the time of this writing, gl does not support
    // the WEBGL_lose_context extension.
    expect(() => {
        canvas.dispatchEvent(new window.Event('webglcontextlost'));
    }).not.toThrow();
    expect(spy).toHaveBeenCalled();
    map.remove();
});

test('handles "webglcontextrestored" when map is created without style', async () => {
    const map = createMap({deleteStyle: true});
    const canvas = map.getCanvas();

    const contextLostPromise = map.once('webglcontextlost');
    canvas.dispatchEvent(new window.Event('webglcontextlost'));
    await contextLostPromise;

    expect(() => {
        canvas.dispatchEvent(new window.Event('webglcontextrestored'));
    }).not.toThrow();
    map.remove();
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

test('WebGL2 context creation error fires ErrorEvent', () => {
    HTMLCanvasElement.prototype.getContext = function (type: string) {
        if (type === 'webgl2') {
            const errorEvent = new Event('webglcontextcreationerror');
            (errorEvent as any).statusMessage = 'mocked webglcontextcreationerror message';
            (this as HTMLCanvasElement).dispatchEvent(errorEvent);
            return null;
        }
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMap();
    const errors = consoleErrorSpy.mock.calls.map(c => c[0]).filter((e): e is Error => e instanceof Error);
    expect(errors.some(e => e.message.includes('Failed to initialize WebGL'))).toBe(true);
    consoleErrorSpy.mockRestore();
});

test('ErrorEvent fires when getContext webgl2 returns null', () => {
    HTMLCanvasElement.prototype.getContext = function (_type: string) {
        return null;
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMap();
    const errors = consoleErrorSpy.mock.calls.map(c => c[0]).filter((e): e is Error => e instanceof Error);
    expect(errors.some(e => e.message.includes('Failed to initialize WebGL'))).toBe(true);
    consoleErrorSpy.mockRestore();
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
