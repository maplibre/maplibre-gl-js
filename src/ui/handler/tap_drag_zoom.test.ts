
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

function createTapDragZoomMap() {
    const map = createMap();
    map.handlers._handlersById.tapZoom.disable();

    return {map, target: map.getCanvas()};
}

function startDoubleTapDragGesture(map: Map, target: HTMLElement) {
    const pointTouchOptions = {
        touches: [{target, clientX: 100, clientY: 100}]
    };

    simulate.touchstart(target, pointTouchOptions);
    simulate.touchend(target);
    simulate.touchstart(target, pointTouchOptions);
    map._renderTaskQueue.run();
}

function moveDoubleTapDragGesture(map: Map, target: HTMLElement, clientY: number) {
    simulate.touchmove(target, {
        touches: [{target, clientX: 100, clientY}]
    });
    map._renderTaskQueue.run();
}

function endDoubleTapDragGesture(map: Map, target: HTMLElement) {
    simulate.touchend(target);
    map._renderTaskQueue.run();
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
        const {map: defaultMap, target: defaultTarget} = createTapDragZoomMap();
        const defaultStartZoom = defaultMap.getZoom();

        startDoubleTapDragGesture(defaultMap, defaultTarget);
        moveDoubleTapDragGesture(defaultMap, defaultTarget, 110);

        const defaultZoomDelta = defaultMap.getZoom() - defaultStartZoom;

        endDoubleTapDragGesture(defaultMap, defaultTarget);
        defaultMap.remove();

        const {map: slowMap, target: slowTarget} = createTapDragZoomMap();
        slowMap.touchZoomRotate.setZoomRate(0.5);
        const slowStartZoom = slowMap.getZoom();

        startDoubleTapDragGesture(slowMap, slowTarget);
        moveDoubleTapDragGesture(slowMap, slowTarget, 110);

        const slowZoomDelta = slowMap.getZoom() - slowStartZoom;

        endDoubleTapDragGesture(slowMap, slowTarget);
        slowMap.remove();

        expect(defaultZoomDelta).toBeGreaterThan(slowZoomDelta);
        expect(slowZoomDelta).toBeCloseTo(defaultZoomDelta * 0.5, 5);
    });

    test('TapDragZoomHandler restores the default double-tap drag zoom rate', () => {
        const {map: defaultMap, target: defaultTarget} = createTapDragZoomMap();
        const defaultStartZoom = defaultMap.getZoom();

        startDoubleTapDragGesture(defaultMap, defaultTarget);
        moveDoubleTapDragGesture(defaultMap, defaultTarget, 110);

        const defaultZoomDelta = defaultMap.getZoom() - defaultStartZoom;

        endDoubleTapDragGesture(defaultMap, defaultTarget);
        defaultMap.remove();

        const {map: restoredMap, target: restoredTarget} = createTapDragZoomMap();
        restoredMap.touchZoomRotate.setZoomRate(0.5);
        restoredMap.touchZoomRotate.setZoomRate(undefined);
        const restoredStartZoom = restoredMap.getZoom();

        startDoubleTapDragGesture(restoredMap, restoredTarget);
        moveDoubleTapDragGesture(restoredMap, restoredTarget, 110);

        const restoredZoomDelta = restoredMap.getZoom() - restoredStartZoom;

        endDoubleTapDragGesture(restoredMap, restoredTarget);
        restoredMap.remove();

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
