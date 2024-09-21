import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('does not fire "webglcontextlost" after #remove has been called', () => new Promise<void>((done) => {
    const map = createMap();
    const canvas = map.getCanvas();
    map.once('webglcontextlost', () => { throw new Error('"webglcontextlost" fired after #remove has been called'); });
    map.remove();
    // Dispatch the event manually because at the time of this writing, gl does not support
    // the WEBGL_lose_context extension.
    canvas.dispatchEvent(new window.Event('webglcontextlost'));
    done();
}));

test('does not fire "webglcontextrestored" after #remove has been called', () => new Promise<void>((done) => {
    const map = createMap();
    const canvas = map.getCanvas();

    map.once('webglcontextlost', () => {
        map.once('webglcontextrestored', () => { throw new Error('"webglcontextrestored" fired after #remove has been called'); });
        map.remove();
        canvas.dispatchEvent(new window.Event('webglcontextrestored'));
        done();
    });

    // Dispatch the event manually because at the time of this writing, gl does not support
    // the WEBGL_lose_context extension.
    canvas.dispatchEvent(new window.Event('webglcontextlost'));
}));

test('WebGL error while creating map', () => {
    const original = HTMLCanvasElement.prototype.getContext;
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
    } finally {
        HTMLCanvasElement.prototype.getContext = original;
    }
});
test('Hit WebGL max drawing buffer limit', () => {
    // Simulate a device with MAX_TEXTURE_SIZE=16834 and max rendering area of ~32Mpx
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 8000});
    Object.defineProperty(container, 'clientHeight', {value: 4500});
    const map = createMap({container, maxCanvasSize: [16834, 16834], pixelRatio: 1});
    jest.spyOn(map.painter.context.gl, 'drawingBufferWidth', 'get').mockReturnValue(7536);
    jest.spyOn(map.painter.context.gl, 'drawingBufferHeight', 'get').mockReturnValue(4239);
    map.resize();
    expect(map.getCanvas().width).toBe(7536);
    expect(map.getCanvas().height).toBe(4239);
    // Check if maxCanvasSize is updated
    expect(map._maxCanvasSize).toEqual([7536, 4239]);
});
