import {describe, beforeEach, test, expect, vi} from 'vitest';
import {extend} from '../../util/util';
import {Map} from '../../ui/map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {browser} from '../../util/browser';
import {beforeMapTest} from '../../util/test/util';

function createMap(options?) {
    return new Map(extend({container: DOM.create('div', '', window.document.body)}, options));
}

beforeEach(() => {
    beforeMapTest();
});

describe('mouse rotate', () => {
    test('MouseRotateHandler.isActive', () => {
        const map = createMap({interactive: true});
        const mouseRotate = map.handlers._handlersById.mouseRotate;

        // Prevent inertial rotation.
        vi.spyOn(browser, 'now').mockReturnValue(0);
        expect(mouseRotate.isActive()).toBe(false);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(false);

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(true);

        simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(false);

        map.remove();
    });

    test('MouseRotateHandler.isActive #4622 regression test', () => {
        const map = createMap({interactive: true});
        const mouseRotate = map.handlers._handlersById.mouseRotate;

        // Prevent inertial rotation.
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(false);

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(true);

        // Some browsers don't fire mouseup when it happens outside the window.
        // Make the handler in active when it encounters a mousemove without the button pressed.

        simulate.mousemove(map.getCanvas(), {buttons: 0, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(mouseRotate.isActive()).toBe(false);

        map.remove();
    });

    test('MouseRotateHandler rotate around center', () => {
        const map = createMap({interactive: true});

        expect(map.getBearing()).toBe(0);

        // Prevent inertial rotation.
        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 0, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        
        expect(map.getBearing()).toBeCloseTo(-1.39233, 4);

        map.remove();
    });

    test('MouseRotateHandler rotate around center but not too much', () => {
        const map = createMap({interactive: true});

        expect(map.getBearing()).toBe(0);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2, clientX: map.getCanvas().width / 2 + 10, clientY: map.getCanvas().height / 2 + 10});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: map.getCanvas().width / 2 + 10, clientY: map.getCanvas().height / 2 - 10});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: map.getCanvas().width / 2 + 20, clientY: map.getCanvas().height / 2 - 10});
        map._renderTaskQueue.run();
        
        expect(map.getBearing()).toBe(-8);

        map.remove();
    });
});
