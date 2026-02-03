import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Map, type MapOptions} from '../map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest} from '../../util/test/util';

// Constants for touch long-press detection (matching tap_recognizer.ts)
const LONG_PRESS_DURATION = 500; // ms
const MAX_DIST = 30; // px

function createMap() {
    return new Map({interactive: true, container: DOM.create('div', '', window.document.body)} as any as MapOptions);
}

beforeEach(() => {
    beforeMapTest();
});

describe('map events', () => {
    test('MapEvent handler fires touch events with correct values', () => {
        const map = createMap();
        const target = map.getCanvas();

        const touchstart = vi.fn();
        const touchmove = vi.fn();
        const touchend = vi.fn();

        map.on('touchstart', touchstart);
        map.on('touchmove', touchmove);
        map.on('touchend', touchend);

        const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
        const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
        const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchstart.mock.calls[0][0].point).toEqual({x: 0, y: 50});
        expect(touchmove).toHaveBeenCalledTimes(0);
        expect(touchend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchmove).toHaveBeenCalledTimes(1);
        expect(touchmove.mock.calls[0][0].point).toEqual({x: 0, y: 60});
        expect(touchend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchmove).toHaveBeenCalledTimes(1);
        expect(touchend).toHaveBeenCalledTimes(1);
        expect(touchend.mock.calls[0][0].point).toEqual({x: 0, y: 60});

        map.remove();
    });

    test('MapEvent handler fires touchmove even while drag handler is active', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const touchstart = vi.fn();
        const touchmove = vi.fn();
        const touchend = vi.fn();
        const drag = vi.fn();

        map.on('touchstart', touchstart);
        map.on('touchmove', touchmove);
        map.on('touchend', touchend);
        map.on('drag', drag);

        const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
        const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
        const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchstart.mock.calls[0][0].point).toEqual({x: 0, y: 50});
        expect(touchmove).toHaveBeenCalledTimes(0);
        expect(touchend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchmove).toHaveBeenCalledTimes(1);
        expect(touchmove.mock.calls[0][0].point).toEqual({x: 0, y: 60});
        expect(touchend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
        expect(touchstart).toHaveBeenCalledTimes(1);
        expect(touchmove).toHaveBeenCalledTimes(1);
        expect(touchend).toHaveBeenCalledTimes(1);
        expect(touchend.mock.calls[0][0].point).toEqual({x: 0, y: 60});

        map._renderTaskQueue.run();
        expect(drag).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('MapEvent handler fires contextmenu on MacOS/Linux, but only at mouseup', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();

        map.on('contextmenu', contextmenu);

        simulate.mousedown(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        simulate.contextmenu(map.getCanvas(), {target}); // triggered immediately after mousedown
        expect(contextmenu).toHaveBeenCalledTimes(0);
        simulate.mouseup(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        expect(contextmenu).toHaveBeenCalledTimes(1);
    });

    test('MapEvent handler does not fire contextmenu on MacOS/Linux, when moved', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();

        map.on('contextmenu', contextmenu);

        simulate.mousedown(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        simulate.contextmenu(map.getCanvas(), {target}); // triggered immediately after mousedown
        simulate.mousemove(map.getCanvas(), {target, buttons: 2, clientX: 50, clientY: 10});
        simulate.mouseup(map.getCanvas(), {target, button: 2, clientX: 70, clientY: 10});
        expect(contextmenu).toHaveBeenCalledTimes(0);
    });

    test('MapEvent handler fires contextmenu on Windows', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();

        map.on('contextmenu', contextmenu);

        simulate.mousedown(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        simulate.mouseup(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        expect(contextmenu).toHaveBeenCalledTimes(0);
        simulate.contextmenu(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10}); // triggered only after mouseup
        expect(contextmenu).toHaveBeenCalledTimes(1);
    });

    test('MapEvent handler does not fire contextmenu on Windows, when moved', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();

        map.on('contextmenu', contextmenu);

        simulate.mousedown(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10});
        simulate.mousemove(map.getCanvas(), {target, buttons: 2, clientX: 50, clientY: 10});
        simulate.mouseup(map.getCanvas(), {target, button: 2, clientX: 50, clientY: 10});
        simulate.contextmenu(map.getCanvas(), {target, button: 2, clientX: 10, clientY: 10}); // triggered only after mouseup
        expect(contextmenu).toHaveBeenCalledTimes(0);
    });

    test('MapMouseEvent constructor does not throw error with Event instance instead of MouseEvent as originalEvent param', () => {
        const map = createMap();
        const target = map.getCanvasContainer();

        expect(()=> {
            target.dispatchEvent(new Event('mousedown'));
            target.dispatchEvent(new Event('mouseup'));
            target.dispatchEvent(new Event('click'));
            target.dispatchEvent(new Event('dblclick'));
            target.dispatchEvent(new Event('mousemove'));
            target.dispatchEvent(new Event('mouseover'));
            target.dispatchEvent(new Event('mouseenter'));
            target.dispatchEvent(new Event('mouseleave'));
            target.dispatchEvent(new Event('mouseout'));
            target.dispatchEvent(new Event('contextmenu'));
            target.dispatchEvent(new Event('wheel'));

            target.dispatchEvent(new Event('touchstart'));
            target.dispatchEvent(new Event('touchmove'));
            target.dispatchEvent(new Event('touchmoveWindow'));
            target.dispatchEvent(new Event('touchend'));
            target.dispatchEvent(new Event('touchcancel'));
        }).not.toThrow();
    });
});

describe('touch long-press contextmenu', () => {
    test('Should fire contextmenu on touch long-press (500ms)', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(contextmenu).toHaveBeenCalledTimes(0);

        // Advance time to 500ms (long-press duration)
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should have fired
        expect(contextmenu).toHaveBeenCalledTimes(1);

        // Verify event has correct point coordinates
        expect(contextmenu.mock.calls[0][0].point).toEqual({x: 100, y: 100});

        map.remove();
        vi.useRealTimers();
    });

    test('Should NOT fire contextmenu if touch released before 500ms', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];
        const touchesEnd = [{target, identifier: 1, clientX: 100, clientY: 100}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(contextmenu).toHaveBeenCalledTimes(0);

        // Advance time to 100ms (less than long-press duration)
        vi.advanceTimersByTime(100);
        map._renderTaskQueue.run();

        // End touch before long-press duration
        simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});

        // Advance time past the long-press threshold
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should NOT have fired
        expect(contextmenu).toHaveBeenCalledTimes(0);

        map.remove();
        vi.useRealTimers();
    });

    test('Should NOT fire contextmenu if touch moves more than 30px', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];
        // Move more than MAX_DIST (30px)
        const touchesMove = [{target, identifier: 1, clientX: 100, clientY: 100 + MAX_DIST + 10}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(contextmenu).toHaveBeenCalledTimes(0);

        // Move touch beyond threshold
        simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});

        // Advance time past long-press duration
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should NOT have fired because touch moved too far
        expect(contextmenu).toHaveBeenCalledTimes(0);

        map.remove();
        vi.useRealTimers();
    });

    test('Should cancel long-press on touchcancel', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(contextmenu).toHaveBeenCalledTimes(0);

        // Advance time partially (100ms)
        vi.advanceTimersByTime(100);
        map._renderTaskQueue.run();

        // Cancel touch (e.g., by system gesture)
        simulate.touchcancel(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesStart});

        // Advance time past long-press duration
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should NOT have fired due to touchcancel
        expect(contextmenu).toHaveBeenCalledTimes(0);

        map.remove();
        vi.useRealTimers();
    });

    test('Should only work with single touch (multi-touch should NOT initiate long-press)', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        // Multi-touch with two fingers
        const touchesStart = [
            {target, identifier: 1, clientX: 100, clientY: 100},
            {target, identifier: 2, clientX: 150, clientY: 150}
        ];

        // Start multi-touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
        expect(contextmenu).toHaveBeenCalledTimes(0);

        // Advance time past long-press duration
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should NOT have fired for multi-touch
        expect(contextmenu).toHaveBeenCalledTimes(0);

        map.remove();
        vi.useRealTimers();
    });

    test('Should fire contextmenu only once even if touch held for extended time', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});

        // Advance time well past long-press duration (2x)
        vi.advanceTimersByTime(LONG_PRESS_DURATION * 2);
        map._renderTaskQueue.run();

        // contextmenu should only fire once
        expect(contextmenu).toHaveBeenCalledTimes(1);

        map.remove();
        vi.useRealTimers();
    });

    test('Should NOT fire contextmenu if touch movement stays within threshold (less than 30px)', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];
        // Move within threshold (less than MAX_DIST)
        const touchesMove = [{target, identifier: 1, clientX: 100, clientY: 100 + MAX_DIST - 5}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});

        // Move touch slightly within threshold
        simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});

        // Advance time past long-press duration
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should still fire because movement was within threshold
        expect(contextmenu).toHaveBeenCalledTimes(1);

        map.remove();
        vi.useRealTimers();
    });

    test('Should work correctly with dragPan enabled (long-press without movement)', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();
        map.on('contextmenu', contextmenu);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});

        // Advance time to long-press duration (without any movement)
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should fire even with dragPan enabled
        expect(contextmenu).toHaveBeenCalledTimes(1);

        map.remove();
        vi.useRealTimers();
    });

    test('Should NOT fire contextmenu when panning during long-press', () => {
        vi.useFakeTimers();
        const map = createMap();
        const target = map.getCanvas();
        map.dragPan.enable();

        const contextmenu = vi.fn();
        const drag = vi.fn();
        map.on('contextmenu', contextmenu);
        map.on('drag', drag);

        const touchesStart = [{target, identifier: 1, clientX: 100, clientY: 100}];
        // Pan movement beyond threshold
        const touchesMove = [{target, identifier: 1, clientX: 100, clientY: 200}];

        // Start touch
        simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});

        // Move touch to trigger pan
        simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});

        // Advance time past long-press duration
        vi.advanceTimersByTime(LONG_PRESS_DURATION);
        map._renderTaskQueue.run();

        // contextmenu should NOT fire because pan was initiated
        expect(contextmenu).toHaveBeenCalledTimes(0);

        map.remove();
        vi.useRealTimers();
    });
});
