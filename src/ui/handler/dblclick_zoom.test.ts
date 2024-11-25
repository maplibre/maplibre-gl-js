import {describe, beforeEach, test, expect, vi} from 'vitest';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest, sleep} from '../../util/test/util';
import {Map, type MapOptions} from '../map';

function createMap() {
    return new Map({container: window.document.createElement('div')} as any as MapOptions);
}

async function simulateDoubleTap(map, delay = 100) {
    const canvas = map.getCanvas();

    simulate.touchstart(canvas, {touches: [{target: canvas, clientX: 0, clientY: 0}]});
    simulate.touchend(canvas);

    await sleep(delay);

    simulate.touchstart(canvas, {touches: [{target: canvas, clientX: 0, clientY: 0}]});
    simulate.touchend(canvas);
    map._renderTaskQueue.run();
}

beforeEach(() => {
    beforeMapTest();
});

describe('dbclick_zoom', () => {
    test('DoubleClickZoomHandler zooms on dblclick event', () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoomstart', zoom);

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        expect(zoom).toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', () => {
        const map = createMap();

        map.on('dblclick', e => e.preventDefault());

        const zoom = vi.fn();
        map.on('zoomstart', zoom);

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        expect(zoom).not.toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler zooms on double tap if touchstart events are < 300ms apart', async () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoomstart', zoom);

        await simulateDoubleTap(map, 100);
        expect(zoom).toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are > 500ms apart', async () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoom', zoom);

        await simulateDoubleTap(map, 500);

        expect(zoom).not.toHaveBeenCalled();
        map.remove();
    });

    test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', async () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoom', zoom);

        const canvas = map.getCanvas();

        simulate.touchstart(canvas, {touches: [{clientX: 0, clientY: 0}]});
        simulate.touchend(canvas);
        await sleep(100);
        simulate.touchstart(canvas, {touches: [{clientX: 30.5, clientY: 30.5}]});
        simulate.touchend(canvas);
        map._renderTaskQueue.run();

        expect(zoom).not.toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler zooms on the second touchend event of a double tap', () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoomstart', zoom);

        const canvas = map.getCanvas();
        const touchOptions = {touches: [{target: canvas, clientX: 0.5, clientY: 0.5}]};

        simulate.touchstart(canvas, touchOptions);
        simulate.touchend(canvas);
        simulate.touchstart(canvas, touchOptions);
        map._renderTaskQueue.run();
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchcancel(canvas);
        simulate.touchend(canvas);
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchstart(canvas, touchOptions);
        simulate.touchend(canvas);
        simulate.touchstart(canvas, touchOptions);
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchend(canvas);
        map._renderTaskQueue.run();

        expect(zoom).toHaveBeenCalled();

    });

    test('DoubleClickZoomHandler does not zoom on double tap if second touchend is >300ms after first touchstart', async () => {
        const map = createMap();

        const zoom = vi.fn();
        map.on('zoom', zoom);

        const canvas = map.getCanvas();

        simulate.touchstart(canvas);
        simulate.touchend(canvas);
        simulate.touchstart(canvas);
        await sleep(300);
        simulate.touchend(canvas);
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();
    });
});
