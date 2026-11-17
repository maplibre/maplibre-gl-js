import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('requestRenderFrame', () => {

    test('Map._requestRenderFrame schedules a render frame while the style is still loading', () => {
        const map = createMap();
        const spy = vi.spyOn(map, 'triggerRepaint');

        map._requestRenderFrame(() => {});

        expect(map.isStyleLoaded()).toBe(false);
        expect(spy).toHaveBeenCalled();
        map.remove();
    });

    test('a drag while the style is still loading moves the map', async () => {
        server.respondWith('style.json', () => {});
        const map = createMap({interactive: true, style: 'style.json'});
        const center = map.getCenter();
        const moved = map.once('move');

        simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, clientX: 100, clientY: 100});
        simulate.mousemove(window.document.body, {buttons: 1, clientX: 120, clientY: 110});
        await moved;

        expect(map.isStyleLoaded()).toBe(false);
        expect(map.getCenter()).not.toEqual(center);
        map.remove();
    });

    test('Map._requestRenderFrame queues a task for the next render frame', async () => {
        const map = createMap();
        const cb = vi.fn();
        map._requestRenderFrame(cb);
        await map.once('render');
        expect(cb).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('Map._cancelRenderFrame cancels a queued task', async () => {
        const map = createMap();
        const cb = vi.fn();
        const id = map._requestRenderFrame(cb);
        map._cancelRenderFrame(id);
        await map.once('render');
        expect(cb).toHaveBeenCalledTimes(0);
        map.remove();
    });
});
