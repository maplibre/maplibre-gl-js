import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {DOM} from '../../util/dom.ts';
import simulate from '../../../test/unit/lib/simulate_interaction.ts';
import {beforeMapTest, createMap as globalCreateMap} from '../../util/test/util.ts';
import {restoreNow, setNow} from '../../util/time_control.ts';
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

afterEach(() => {
    restoreNow();
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

    test('DragPanHandler glides the globe on over the pole after a flick with a free bearing', async () => {
        const map = globalCreateMap({interactive: true, style: {version: 8, sources: {}, layers: [], projection: {type: 'globe'}}, center: [0, 70], dragPan: {bearing: 'free'}});
        await map.once('load');

        let now = 1000;
        setNow(now);
        simulate.dragInMoves(map.getCanvas(), [100, 80], [100, 140], 3, () => {
            setNow(now += 16);
            map.redraw();
        });
        simulate.mouseup(map.getCanvas(), {clientX: 100, clientY: 140});
        map.redraw();

        expect(map.getCenter().lat).toBeLessThan(88);
        expect(map.getCenter().lng).toBeCloseTo(0, 6);

        setNow(now + 5000);
        map.redraw();

        expect(map.getCenter().lat).toBeLessThan(88);
        expect(Math.abs(map.getCenter().lng)).toBeCloseTo(180, 6);
        expect(Math.abs(map.getBearing())).toBeCloseTo(180, 6);

        map.remove();
    });

    test('DragPanHandler keeps the zoom inertia of a pinch that pans the globe with a free bearing', async () => {
        const map = globalCreateMap({interactive: true, style: {version: 8, sources: {}, layers: [], projection: {type: 'globe'}}, center: [0, 30], zoom: 3, dragPan: {bearing: 'free'}});
        await map.once('load');
        const target = map.getCanvas();

        setNow(1000);
        simulate.touchstart(target, {touches: [{target, identifier: 1, clientX: 70, clientY: 100}, {target, identifier: 2, clientX: 130, clientY: 100}]});
        map.redraw();
        setNow(1016);
        simulate.touchmove(target, {touches: [{target, identifier: 1, clientX: 65, clientY: 105}, {target, identifier: 2, clientX: 145, clientY: 105}]});
        map.redraw();
        setNow(1032);
        simulate.touchmove(target, {touches: [{target, identifier: 1, clientX: 60, clientY: 110}, {target, identifier: 2, clientX: 160, clientY: 110}]});
        map.redraw();
        setNow(1048);
        simulate.touchmove(target, {touches: [{target, identifier: 1, clientX: 55, clientY: 115}, {target, identifier: 2, clientX: 175, clientY: 115}]});
        map.redraw();
        simulate.touchend(target, {touches: []});
        map.redraw();

        expect(map.getZoom()).toBeCloseTo(4, 1);

        setNow(6048);
        map.redraw();

        expect(map.getZoom()).toBeCloseTo(6.5, 1);

        map.remove();
    });
});
