
import {describe, beforeEach, test, expect, vi} from 'vitest';
import {beforeMapTest, sleep} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {Map, type MapOptions} from '../map';

function createMap() {
    return new Map({container: window.document.createElement('div')} as any as MapOptions);
}

function setupEvents(map: Map) {
    const zoomstart = vi.fn();
    map.on('zoomstart', zoomstart);

    const zoom = vi.fn();
    map.on('zoom', zoom);

    const zoomend = vi.fn();
    map.on('zoomend', zoomend);

    return {
        zoomstart,
        zoom,
        zoomend
    };
}

function getTapDragZoomDelta(configure?: (map: Map) => void) {
    const map = createMap();
    const target = map.getCanvas();

    map.handlers._handlersById.tapZoom.disable();
    configure?.(map);

    const startZoom = map.getZoom();
    const pointTouchOptions = {
        touches: [{target, clientX: 100, clientY: 100}]
    };

    simulate.touchstart(target, pointTouchOptions);
    simulate.touchend(target);
    simulate.touchstart(target, pointTouchOptions);
    map._renderTaskQueue.run();

    simulate.touchmove(target, {
        touches: [{target, clientX: 100, clientY: 110}]
    });
    map._renderTaskQueue.run();

    const zoomDelta = map.getZoom() - startZoom;

    simulate.touchend(target);
    map._renderTaskQueue.run();
    map.remove();

    return zoomDelta;
}

beforeEach(() => {
    beforeMapTest();
});

describe('tap_drag_zoom', () => {
    test('TapDragZoomHandler fires zoomstart, zoom, and zoomend at appropriate times in response to a double-tap and drag gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        const pointTouchOptions = {
            touches: [{target, clientX: 100, clientY: 100}]
        };

        simulate.touchstart(target, pointTouchOptions);
        simulate.touchend(target);
        simulate.touchstart(target, pointTouchOptions);
        map._renderTaskQueue.run();

        expect(zoomstart).not.toHaveBeenCalled();
        expect(zoom).not.toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();

        simulate.touchmove(target, {
            touches: [{target, clientX: 100, clientY: 110}]
        });
        map._renderTaskQueue.run();

        expect(zoomstart).toHaveBeenCalled();
        expect(zoom).toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();

        simulate.touchend(target);
        map._renderTaskQueue.run();
        expect(zoomend).toHaveBeenCalled();

    });

    test('TapDragZoomHandler does not fire zoom on tap and drag if touchstart events are > 500ms apart', async () => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        const pointTouchOptions = {
            touches: [{target, clientX: 100, clientY: 100}]
        };

        simulate.touchstart(target, pointTouchOptions);
        simulate.touchend(target);

        await sleep(510);

        simulate.touchstart(target, pointTouchOptions);
        simulate.touchmove(target, {
            touches: [{target, clientX: 100, clientY: 110}]
        });
        map._renderTaskQueue.run();

        expect(zoomstart).not.toHaveBeenCalled();
        expect(zoom).not.toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();
    });

    test('TapDragZoomHandler scales double-tap drag zoom with setZoomRate', () => {
        const defaultZoomDelta = getTapDragZoomDelta();
        const slowZoomDelta = getTapDragZoomDelta((map) => map.touchZoomRotate.setZoomRate(0.5));

        expect(defaultZoomDelta).toBeGreaterThan(slowZoomDelta);
        expect(slowZoomDelta).toBeCloseTo(defaultZoomDelta * 0.5, 5);
    });

    test('TapDragZoomHandler restores the default double-tap drag zoom rate', () => {
        const defaultZoomDelta = getTapDragZoomDelta();
        const restoredZoomDelta = getTapDragZoomDelta((map) => {
            map.touchZoomRotate.setZoomRate(0.5);
            map.touchZoomRotate.setZoomRate(undefined);
        });

        expect(restoredZoomDelta).toBeCloseTo(defaultZoomDelta, 5);
    });

    test('TapDragZoomHandler does not zoom on double-tap and drag if touchstart events are in different locations (>30px apart)', () => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        simulate.touchstart(target, {
            touches: [{target, clientX: 100, clientY: 100}]
        });
        simulate.touchend(target);
        simulate.touchstart(target, {
            touches: [{target, clientX: 140, clientY: 100}]
        });
        simulate.touchmove(target, {
            touches: [{target, clientX: 140, clientY: 110}]
        });
        map._renderTaskQueue.run();

        expect(zoomstart).not.toHaveBeenCalled();
        expect(zoom).not.toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();
    });
});
