import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest} from '../../util/test/util';
import {Map, MapOptions} from '../map';
import type {MapGeoJSONFeature} from '../../util/vectortile_to_geojson';

function createMap(clickTolerance?, dragPan?) {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true,
    } as any as MapOptions);
}

beforeEach(() => {
    beforeMapTest();
});

// MouseEvent.buttons = 1 // left button
const buttons = 1;

describe('drag_pan', () => {

    test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', () => {
        const map = createMap();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        const mousemove = jest.fn();
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

        const dragend = jest.fn();
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

        const dragend = jest.fn();
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
        const requestFrame = jest.spyOn(map.handlers, '_requestFrame');

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

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
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

    ['ctrl', 'shift'].forEach((modifier) => {
        test(`DragPanHandler does not begin a drag if the ${modifier} key is down on mousedown`, () => {
            const map = createMap();
            expect(map.dragRotate.isEnabled()).toBeTruthy();

            const dragstart = jest.fn();
            const drag      = jest.fn();
            const dragend   = jest.fn();

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

        test(`DragPanHandler still ends a drag if the ${modifier} key is down on mouseup`, () => {
            const map = createMap();
            expect(map.dragRotate.isEnabled()).toBeTruthy();

            const dragstart = jest.fn();
            const drag      = jest.fn();
            const dragend   = jest.fn();

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
    });

    test('DragPanHandler does not begin a drag on right button mousedown', () => {
        const map = createMap();
        map.dragRotate.disable();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        map.on('mousedown', e => e.preventDefault());

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        map.on('touchstart', e => e.preventDefault());

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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

        jest.spyOn(map, 'getLayer').mockReturnValue(true as any);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        map.on('touchstart', 'point', (e) => {
            e.preventDefault();
        });

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

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
});
