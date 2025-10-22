import {describe, beforeEach, test, expect, vi} from 'vitest';
import * as timeControl from '../../util/time_control';
import {Map} from '../map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest, sleep} from '../../util/test/util';

function createMap(cooperativeGestures) {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        style: {
            'version': 8,
            'sources': {},
            'layers': []
        },
        cooperativeGestures
    });
}

beforeEach(() => {
    beforeMapTest();
});

describe('CoopGesturesHandler', () => {

    test('Does not zoom on wheel if no key is down', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(true);
        map._renderTaskQueue.run();

        const cooperativegestureprevented = vi.fn();
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        const startZoom = map.getZoom();
        // simulate a single 'wheel' event
        const wheelEvent = {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta};
        simulate.wheel(map.getCanvas(), wheelEvent);
        map._renderTaskQueue.run();
        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeInstanceOf(HTMLDivElement);

        // ensure events are emitted when cooperative gesture is prevented
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(1);
        expect(cooperativegestureprevented).toHaveBeenCalledWith(expect.objectContaining({
            type: 'cooperativegestureprevented',
            gestureType: 'wheel_zoom',
        }));
        expect(cooperativegestureprevented.mock.calls[0][0].originalEvent).toMatchObject(wheelEvent);

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const endZoom = map.getZoom();
        expect(endZoom).toBeCloseTo(startZoom);

        await sleep(200);

        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeNull();
        map.remove();
    });

    test('Zooms on wheel if no key is down after disabling cooperative gestures', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(true);
        map.cooperativeGestures.disable();
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const endZoom = map.getZoom();
        expect(endZoom - startZoom).toBeCloseTo(0.0285, 3);

        map.remove();
    });

    test('Zooms on wheel if control key is down', () => {
        // NOTE: This should pass regardless of whether cooperativeGestures is enabled or not
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(true);
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, ctrlKey: true});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const endZoom = map.getZoom();
        expect(endZoom - startZoom).toBeCloseTo(0.0285, 3);

        map.remove();
    });

    test('Zooms on trackpad pinch when metaKey is the bypass key', () => {
        // NOTE: This should pass regardless of whether cooperativeGestures is enabled or not
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(true);

        // pretend we're on a Mac, where the ctrlKey isn't the bypassKey
        map.cooperativeGestures._bypassKey = 'metaKey';
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate a single 'wheel' trackpad pinch event
        simulate.wheel(map.getCanvas(), {
            type: 'wheel',
            deltaY: -simulate.magicWheelZoomDelta,

            // this is how a browser identifies a trackpad pinch
            ctrlKey: true
        });
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const endZoom = map.getZoom();
        expect(endZoom - startZoom).toBeCloseTo(0.0285, 3);

        map.remove();
    });

    test('Does not show message if scrollZoom is disabled', () => {
        // NOTE: This should pass regardless of whether cooperativeGestures is enabled or not
        const timeControlNow = vi.spyOn(timeControl, 'now');
        const now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(true);

        const cooperativegestureprevented = vi.fn();
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        map.scrollZoom.disable();
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();
        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeNull();

        // ensure events are not emitted when cooperative gesture is prevented
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('Does not pan on touchmove with a single touch', () => {
        const map = createMap(true);
        const target = map.getCanvas();
        const startCenter = map.getCenter();
        map._renderTaskQueue.run();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend = vi.fn();
        const cooperativegestureprevented = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend', dragend);
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        simulate.touchstart(target, {touches: [{target, clientX: 0, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(target, {touches: [{target, clientX: 10, clientY: 10}]});
        map._renderTaskQueue.run();

        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeInstanceOf(HTMLDivElement);

        // ensure events are emitted when cooperative gesture is prevented
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(1);
        expect(cooperativegestureprevented).toHaveBeenCalledWith(expect.objectContaining({
            type: 'cooperativegestureprevented',
            gestureType: 'touch_pan',
        }));
        expect(cooperativegestureprevented.mock.calls[0][0].originalEvent.touches[0].clientX).toBe(10);

        simulate.touchend(target);
        map._renderTaskQueue.run();

        const endCenter = map.getCenter();
        expect(endCenter.lng).toEqual(startCenter.lng);
        expect(endCenter.lat).toEqual(startCenter.lat);

        map.remove();
    });

    test('Pans on touchmove with a single touch after disabling cooperative gestures', () => {
        const map = createMap(true);
        const cooperativegestureprevented = vi.fn();
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        map.cooperativeGestures.disable();
        const target = map.getCanvasContainer();
        const startCenter = map.getCenter();
        map._renderTaskQueue.run();

        simulate.touchstart(target, {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 1, clientY: 1}]});
        map._renderTaskQueue.run();

        simulate.touchmove(target, {touches: [{target, clientX: 10, clientY: 10}, {target, clientX: 11, clientY: 11}]});
        map._renderTaskQueue.run();

        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeNull();
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(0);

        simulate.touchend(target);
        map._renderTaskQueue.run();

        const endCenter = map.getCenter();
        expect(endCenter.lng).toBeGreaterThan(startCenter.lng);
        expect(endCenter.lat).toBeGreaterThan(startCenter.lat);

        map.remove();
    });

    test('Does pan on touchmove with a double touch but does not change pitch', () => {
        const map = createMap(true);

        const cooperativegestureprevented = vi.fn();
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        const target = map.getCanvas();
        const startCenter = map.getCenter();
        const startPitch = map.getPitch();
        map._renderTaskQueue.run();

        simulate.touchstart(target, {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 1, clientY: 1}]});
        map._renderTaskQueue.run();

        simulate.touchmove(target, {touches: [{target, clientX: 10, clientY: 10}, {target, clientX: 11, clientY: 11}]});
        map._renderTaskQueue.run();

        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeNull();
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(0);

        simulate.touchend(target);
        map._renderTaskQueue.run();

        const endCenter = map.getCenter();
        expect(endCenter.lng).toBeGreaterThan(startCenter.lng);
        expect(endCenter.lat).toBeGreaterThan(startCenter.lat);
        expect(startPitch).toBe(map.getPitch());

        map.remove();
    });

    test('Drag pitch works with 3 fingers', () => {
        // NOTE: This should pass regardless of whether cooperativeGestures is enabled or not
        const map = createMap(true);

        const cooperativegestureprevented = vi.fn();
        map.on('cooperativegestureprevented', cooperativegestureprevented);

        const target = map.getCanvas();
        const startPitch = map.getPitch();
        map._renderTaskQueue.run();

        simulate.touchstart(target, {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 1, clientY: 1}, {target, clientX: 2, clientY: 2}]});
        map._renderTaskQueue.run();

        simulate.touchmove(target, {touches: [{target, clientX: 0, clientY: -10}, {target, clientX: 1, clientY: -11}, {target, clientX: 2, clientY: -12}]});
        map._renderTaskQueue.run();

        expect(map.getContainer().querySelector('.maplibregl-cooperative-gesture-screen.maplibregl-show')).toBeNull();
        expect(cooperativegestureprevented).toHaveBeenCalledTimes(0);

        simulate.touchend(target);
        map._renderTaskQueue.run();

        const endPitch = map.getPitch();
        expect(endPitch).toBeGreaterThan(startPitch);

        map.remove();
    });

    test('Initially disabled cooperative gestures can be later enabled', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap(false);
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const midZoom = map.getZoom();
        expect(midZoom - startZoom).toBeCloseTo(0.0285, 3);

        // Enable cooperative gestures
        map.cooperativeGestures.enable();

        // This 'wheel' event should not zoom
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        const endZoom = map.getZoom();
        expect(endZoom).toBeCloseTo(midZoom);

        map.remove();
    });

});
