import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../../../rollup/build/tsc/src/ui/map';
import DOM from '../../../../rollup/build/tsc/src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap(clickTolerance, dragPan) {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true
    });
}

// MouseEvent.buttons = 1 // left button
const buttons = 1;

test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', (t) => {
    const map = createMap();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler captures mousemove events during a mouse-triggered drag (receives them even if they occur outside the map)', (t) => {
    const map = createMap();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(window.document.body, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag', (t) => {
    const map = createMap();
    const target = map.getCanvas();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler prevents mousemove events from firing during a drag (#1555)', (t) => {
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvasContainer(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvasContainer());
    map._renderTaskQueue.run();

    expect(mousemove.notCalled).toBeTruthy();

    map.remove();
    t.end();
});

test('DragPanHandler ends a mouse-triggered drag if the window blurs', (t) => {
    const map = createMap();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.blur(window);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler ends a touch-triggered drag if the window blurs', (t) => {
    const map = createMap();
    const target = map.getCanvas();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.blur(window);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap();
    const requestFrame = t.spy(map.handlers, '_requestFrame');

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    expect(requestFrame.callCount > 0).toBeTruthy();

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestFrame.resetHistory();
    simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
    expect(requestFrame.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler can interleave with another handler', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    // simulate a scroll zoom
    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

['ctrl', 'shift'].forEach((modifier) => {
    test(`DragPanHandler does not begin a drag if the ${modifier} key is down on mousedown`, (t) => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {buttons, [`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        simulate.mousemove(map.getCanvas(), {buttons, [`${modifier}Key`]: true, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        map.remove();
        t.end();
    });

    test(`DragPanHandler still ends a drag if the ${modifier} key is down on mouseup`, (t) => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart.callCount).toBe(0);
        expect(drag.callCount).toBe(0);
        expect(dragend.callCount).toBe(0);

        map.remove();
        t.end();
    });
});

test('DragPanHandler does not begin a drag on right button mousedown', (t) => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});

test('DragPanHandler does not end a drag on right button mouseup', (t) => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mousedown(map.getCanvas(), {buttons: buttons + 2, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas(), {buttons, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the mousedown event', (t) => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();

    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event', (t) => {
    const map = createMap();
    const target = map.getCanvas();

    map.on('touchstart', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();

    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event (delegated)', (t) => {
    const map = createMap();
    const target = map.getCanvas();

    t.stub(map, 'getLayer')
        .callsFake(() => true);
    t.stub(map, 'queryRenderedFeatures')
        .callsFake(() => [{}]);

    map.on('touchstart', 'point', (e) => {
        e.preventDefault();
    });

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();

    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});
