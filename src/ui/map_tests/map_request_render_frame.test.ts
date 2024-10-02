import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
});

describe('requestRenderFrame', () => {

    test('Map#_requestRenderFrame schedules a new render frame if necessary', () => new Promise<void>(done => {
        const map = createMap();
        const spy = vi.spyOn(map, 'triggerRepaint');
        map._requestRenderFrame(() => {});
        expect(spy).toHaveBeenCalledTimes(0);

        // wait for style to be loaded
        map.once('data', () => {
            spy.mockReset();
            map._requestRenderFrame(() => {});
            expect(spy).toHaveBeenCalledTimes(1);
            map.remove();
            done();
        });
    }));

    test('Map#_requestRenderFrame should not schedule a render frame before style load', () => {
        const map = createMap();
        const spy = vi.spyOn(map, 'triggerRepaint');
        map._requestRenderFrame(() => {});
        expect(spy).toHaveBeenCalledTimes(0);
        map.remove();
    });

    test('Map#_requestRenderFrame queues a task for the next render frame', async () => {
        const map = createMap();
        const cb = vi.fn();
        map._requestRenderFrame(cb);
        await map.once('render');
        expect(cb).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('Map#_cancelRenderFrame cancels a queued task', async () => {
        const map = createMap();
        const cb = vi.fn();
        const id = map._requestRenderFrame(cb);
        map._cancelRenderFrame(id);
        await map.once('render');
        expect(cb).toHaveBeenCalledTimes(0);
        map.remove();
    });
});
