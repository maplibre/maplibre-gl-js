import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Map, type MapOptions} from '../map';
import {Marker} from '../marker';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest} from '../../util/test/util';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)} as any as MapOptions);
}

function createPinchZoomMap() {
    const map = createMap();
    map.touchZoomRotate.disableRotation();
    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();

    return {map, target: map.getCanvas()};
}

function startPinchGesture(map: Map, target: HTMLElement) {
    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}, {target, identifier: 2, clientX: 0, clientY: 50}]});
    map._renderTaskQueue.run();
}

function movePinchGesture(map: Map, target: HTMLElement, topY: number, bottomY: number) {
    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: topY}, {target, identifier: 2, clientX: 0, clientY: bottomY}]});
    map._renderTaskQueue.run();
}

function endPinchGesture(map: Map) {
    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    map._renderTaskQueue.run();
}

beforeEach(() => {
    beforeMapTest();
});

describe('touch zoom rotate', () => {

    test('TwoFingersTouchZoomRotateHandler fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const zoomstart = vi.fn();
        const zoom      = vi.fn();
        const zoomend   = vi.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}, {target, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -100}, {target, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -60}, {target, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const rotatestart = vi.fn();
        const rotate      = vi.fn();
        const rotateend   = vi.fn();

        map.on('rotatestart', rotatestart);
        map.on('rotate',      rotate);
        map.on('rotateend',   rotateend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(0);
        expect(rotate).toHaveBeenCalledTimes(0);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: -50, clientY: 0}, {target, identifier: 1, clientX: 50, clientY: 0}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(1);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(2);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(2);
        expect(rotateend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler scales pinch zoom with setZoomRate', () => {
        const {map: defaultMap, target: defaultTarget} = createPinchZoomMap();
        const defaultStartZoom = defaultMap.getZoom();

        startPinchGesture(defaultMap, defaultTarget);
        movePinchGesture(defaultMap, defaultTarget, -100, 100);

        const defaultZoomDelta = defaultMap.getZoom() - defaultStartZoom;

        endPinchGesture(defaultMap);
        defaultMap.remove();

        const {map: slowMap, target: slowTarget} = createPinchZoomMap();
        slowMap.touchZoomRotate.setZoomRate(0.5);
        const slowStartZoom = slowMap.getZoom();

        startPinchGesture(slowMap, slowTarget);
        movePinchGesture(slowMap, slowTarget, -100, 100);

        const slowZoomDelta = slowMap.getZoom() - slowStartZoom;

        endPinchGesture(slowMap);
        slowMap.remove();

        expect(defaultZoomDelta).toBeGreaterThan(slowZoomDelta);
        expect(slowZoomDelta).toBeCloseTo(defaultZoomDelta * 0.5, 5);
    });

    test('TwoFingersTouchZoomRotateHandler restores the default pinch zoom rate', () => {
        const {map: defaultMap, target: defaultTarget} = createPinchZoomMap();
        const defaultStartZoom = defaultMap.getZoom();

        startPinchGesture(defaultMap, defaultTarget);
        movePinchGesture(defaultMap, defaultTarget, -100, 100);

        const defaultZoomDelta = defaultMap.getZoom() - defaultStartZoom;

        endPinchGesture(defaultMap);
        defaultMap.remove();

        const {map: restoredMap, target: restoredTarget} = createPinchZoomMap();
        restoredMap.touchZoomRotate.setZoomRate(0.5);
        restoredMap.touchZoomRotate.setZoomRate(undefined);
        const restoredStartZoom = restoredMap.getZoom();

        startPinchGesture(restoredMap, restoredTarget);
        movePinchGesture(restoredMap, restoredTarget, -100, 100);

        const restoredZoomDelta = restoredMap.getZoom() - restoredStartZoom;

        endPinchGesture(restoredMap);
        restoredMap.remove();

        expect(restoredZoomDelta).toBeCloseTo(defaultZoomDelta, 5);
    });

    test('TwoFingersTouchZoomRotateHandler scales pinch sensitivity with setZoomThreshold', () => {
        const {map: defaultMap, target: defaultTarget} = createPinchZoomMap();
        const defaultZoomstart = vi.fn();
        const defaultZoom = vi.fn();
        defaultMap.on('zoomstart', defaultZoomstart);
        defaultMap.on('zoom', defaultZoom);

        startPinchGesture(defaultMap, defaultTarget);
        movePinchGesture(defaultMap, defaultTarget, -55, 55);

        endPinchGesture(defaultMap);
        defaultMap.remove();

        const {map: insensitiveMap, target: insensitiveTarget} = createPinchZoomMap();
        insensitiveMap.touchZoomRotate.setZoomThreshold(10);
        const insensitiveZoomstart = vi.fn();
        const insensitiveZoom = vi.fn();
        insensitiveMap.on('zoomstart', insensitiveZoomstart);
        insensitiveMap.on('zoom', insensitiveZoom);

        startPinchGesture(insensitiveMap, insensitiveTarget);
        movePinchGesture(insensitiveMap, insensitiveTarget, -55, 55);

        endPinchGesture(insensitiveMap);
        insensitiveMap.remove();

        expect(defaultZoomstart).toHaveBeenCalledTimes(1);
        expect(defaultZoom).toHaveBeenCalledTimes(1);
        expect(insensitiveZoomstart).not.toHaveBeenCalled();
        expect(insensitiveZoom).not.toHaveBeenCalled();
    });

    test('TwoFingersTouchZoomRotateHandler restores the default pinch zoom threshold', () => {
        const {map: defaultMap, target: defaultTarget} = createPinchZoomMap();
        const defaultZoomstart = vi.fn();
        const defaultZoom = vi.fn();
        defaultMap.on('zoomstart', defaultZoomstart);
        defaultMap.on('zoom', defaultZoom);

        startPinchGesture(defaultMap, defaultTarget);
        movePinchGesture(defaultMap, defaultTarget, -55, 55);

        endPinchGesture(defaultMap);
        defaultMap.remove();

        const {map: restoredMap, target: restoredTarget} = createPinchZoomMap();
        restoredMap.touchZoomRotate.setZoomThreshold(10);
        restoredMap.touchZoomRotate.setZoomThreshold(undefined);
        const restoredZoomstart = vi.fn();
        const restoredZoom = vi.fn();
        restoredMap.on('zoomstart', restoredZoomstart);
        restoredMap.on('zoom', restoredZoom);

        startPinchGesture(restoredMap, restoredTarget);
        movePinchGesture(restoredMap, restoredTarget, -55, 55);

        endPinchGesture(restoredMap);
        restoredMap.remove();

        expect(restoredZoomstart).toHaveBeenCalledTimes(defaultZoomstart.mock.calls.length);
        expect(restoredZoom).toHaveBeenCalledTimes(defaultZoom.mock.calls.length);
    });

    test('TwoFingersTouchZoomRotateHandler does not begin a gesture if preventDefault is called on the touchstart event', () => {
        const map = createMap();
        const target = map.getCanvas();

        map.on('touchstart', e => { e.preventDefault(); });

        const move = vi.fn();
        map.on('move', move);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 5, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 0, clientY: 5}]});
        map._renderTaskQueue.run();

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        expect(move).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler starts zoom immediately when rotation disabled', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.touchZoomRotate.disableRotation();
        map.handlers._handlersById.tapZoom.disable();

        const zoomstart = vi.fn();
        const zoom      = vi.fn();
        const zoomend   = vi.fn();

        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 5}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 6}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 4}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();
        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler adds css class used for disabling default touch behavior in some browsers', () => {
        const map = createMap();

        const className = 'maplibregl-touch-zoom-rotate';
        expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
        map.touchZoomRotate.disable();
        expect(map.getCanvasContainer().classList.contains(className)).toBeFalsy();
        map.touchZoomRotate.enable();
        expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
    });

    test('TwoFingersTouchZoomRotateHandler zooms when touching two markers on the same map', () => {
        const map = createMap();

        const marker1 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const marker2 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const target1 = marker1.getElement();
        const target2 = marker2.getElement();

        const zoomstart = vi.fn();
        const zoom      = vi.fn();
        const zoomend   = vi.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler does not zoom when touching an element not on the map', () => {
        const map = createMap();

        const marker1 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const marker2 = new Marker()
            .setLngLat([0, 0]);

        const target1 = marker1.getElement(); // on map
        const target2 = marker2.getElement(); // not on map

        const zoomstart = vi.fn();
        const zoom      = vi.fn();
        const zoomend   = vi.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.dragPan.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(0);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        map.remove();
    });
});
