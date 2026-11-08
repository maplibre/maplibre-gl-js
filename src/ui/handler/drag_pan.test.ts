import {describe, beforeEach, test, expect, vi} from 'vitest';
import {DOM} from '../../util/dom.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import {beforeMapTest} from '../../util/test/util.ts';
import * as timeControl from '../../util/time_control.ts';
import {Map} from '../map.ts';

import type {MapGeoJSONFeature} from '../../util/vectortile_to_geojson.ts';

function createMap(clickTolerance?, dragPan?) {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true,
    });
}

beforeEach(() => {
    beforeMapTest();
});

// MouseEvent.buttons = 1 // left button
const buttons = 1;

describe('drag_pan', () => {

    test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', () => {
        const map = createMap();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler captures mousemove events during a mouse-triggered drag (receives them even if they occur outside the map)', () => {
        const map = createMap();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(window.document.body, {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag', () => {
        const map = createMap();
        const target = map.getCanvas();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler prevents mousemove events from firing during a drag (#1555)', () => {
        const map = createMap();

        const mousemove = vi.fn();
        map.on('mousemove', mousemove);

        simulate.mousedown(map.getCanvasContainer());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvasContainer(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvasContainer());
        map._renderTaskQueue.run();

        expect(mousemove).not.toHaveBeenCalled();

        map.remove();
    });

    test('DragPanHandler ends a mouse-triggered drag if the window blurs', () => {
        const map = createMap();

        const dragend = vi.fn();
        map.on('dragend', dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.blur(window);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler ends a touch-triggered drag if the window blurs', () => {
        const map = createMap();
        const target = map.getCanvas();

        const dragend = vi.fn();
        map.on('dragend', dragend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
        map._renderTaskQueue.run();

        simulate.blur(window);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler requests a new render frame after each mousemove event', () => {
        const map = createMap();
        const requestFrame = vi.spyOn(map._handlers, '_requestFrame');

        simulate.mousedown(map.getCanvas());
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        expect(requestFrame).toHaveBeenCalled();

        map._renderTaskQueue.run();

        // https://github.com/mapbox/mapbox-gl-js/issues/6063
        requestFrame.mockReset();
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
        expect(requestFrame).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler can interleave with another handler', () => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
        const map = createMap();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        // simulate a scroll zoom
        simulate.wheel(map.getCanvas(), {deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    const modifiers = ['ctrl', 'shift'];
    test.each(modifiers)('DragPanHandler does not begin a drag if the %s key is down on mousedown', (modifier) => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {buttons, [`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, [`${modifier}Key`]: true, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test.each(modifiers)('DragPanHandler still ends a drag if the %s key is down on mouseup', (modifier) => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('DragPanHandler and the inertia it ends in are one movement', () => {
        const map = createMap();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const movestart = vi.fn();
        const moveend = vi.fn();
        map.on('movestart', movestart);
        map.on('moveend', moveend);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        now.mockReturnValue(10);
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 50, clientY: 0});
        map._renderTaskQueue.run();
        now.mockReturnValue(20);
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 100, clientY: 0});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();

        expect(map.isMoving()).toBe(true);
        expect(moveend).not.toHaveBeenCalled();

        now.mockReturnValue(5000);
        map._renderTaskQueue.run();

        expect(movestart).toHaveBeenCalledTimes(1);
        expect(moveend).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('DragPanHandler leaves padding set during the drag to apply, as part of the drag\'s movement', () => {
        const map = createMap();
        const now = vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const movestart = vi.fn();
        const moveend = vi.fn();
        map.on('movestart', movestart);
        map.on('moveend', moveend);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 0, clientY: 0});
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        map.setPadding({top: 100, bottom: 0, left: 0, right: 0});
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        now.mockReturnValue(5000);
        map._renderTaskQueue.run();

        expect(map.getPadding()).toEqual({top: 100, bottom: 0, left: 0, right: 0});
        expect(movestart).toHaveBeenCalledTimes(1);
        expect(moveend).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('DragPanHandler keeps the camera to itself: an easeTo during the drag does not start', () => {
        const map = createMap();
        vi.spyOn(timeControl, 'now').mockReturnValue(0);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 0, clientY: 0});
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        const center = map.getCenter();
        map.easeTo({center: [50, 50], duration: 0});

        expect(map.getCenter()).toEqual(center);
        map.remove();
    });

    test('DragPanHandler keeps panning after an animation starts and ends while the mouse is held down', () => {
        const map = createMap();
        vi.spyOn(timeControl, 'now').mockReturnValue(0);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        map.easeTo({center: [10, 0], duration: 0});
        const center = map.getCenter();
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 50, clientY: 0});
        map._renderTaskQueue.run();
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 100, clientY: 0});
        map._renderTaskQueue.run();

        expect(map.getCenter().lng).not.toBeCloseTo(center.lng, 5);
        map.remove();
    });

    test('DragPanHandler ends its movement with a moveend when map.stop() ends the drag', () => {
        const map = createMap();
        vi.spyOn(timeControl, 'now').mockReturnValue(0);
        const moveend = vi.fn();
        map.on('moveend', moveend);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 0, clientY: 0});
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        map.stop();

        expect(moveend).toHaveBeenCalledTimes(1);
        expect(map.isMoving()).toBe(false);
        map.remove();
    });

    test('DragPanHandler does not begin a drag on right button mousedown', () => {
        const map = createMap();
        map.dragRotate.disable();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('DragPanHandler does not end a drag on right button mouseup', () => {
        const map = createMap();
        map.dragRotate.disable();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousedown(map.getCanvas(), {buttons: buttons + 2, button: 2});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas(), {buttons, button: 2});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(0);

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('DragPanHandler does not begin a drag if preventDefault is called on the mousedown event', () => {
        const map = createMap();

        map.on('mousedown', e => { e.preventDefault(); });

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();

        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event', () => {
        const map = createMap();
        const target = map.getCanvas();

        map.on('touchstart', e => { e.preventDefault(); });

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
        map._renderTaskQueue.run();

        simulate.touchend(map.getCanvas());
        map._renderTaskQueue.run();

        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event (delegated)', () => {
        const map = createMap();
        const target = map.getCanvas();

        vi.spyOn(map, 'getLayer').mockReturnValue(true as any);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        map.on('touchstart', 'point', (e) => {
            e.preventDefault();
        });

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
        map._renderTaskQueue.run();

        simulate.touchend(map.getCanvas());
        map._renderTaskQueue.run();

        expect(dragstart).toHaveBeenCalledTimes(0);
        expect(drag).toHaveBeenCalledTimes(0);
        expect(dragend).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('DragPanHandler pans from the center when the drag is above the horizon', () => {
        const map = createMap();
        map.setMaxPitch(85);
        map.setPitch(80);

        simulate.mousedown(map.getCanvas(), {buttons, clientX: 100, clientY: 10});
        map._renderTaskQueue.run();
        simulate.mousemove(map.getCanvas(), {buttons, clientX: 120, clientY: 10});
        map._renderTaskQueue.run();
        simulate.mouseup(map.getCanvas(), {clientX: 120, clientY: 10});
        map._renderTaskQueue.run();

        expect(map.getCenter().lng).toBeCloseTo(-14.0625, 10);
        expect(map.getCenter().lat).toBeCloseTo(0, 10);

        map.remove();
    });
});
