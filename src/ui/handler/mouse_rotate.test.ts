import {extend} from '../../util/util';
import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import browser from '../../util/browser';
import {setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';

function createMap(options?) {
    return new Map(extend({container: DOM.create('div', '', window.document.body)}, options));
}

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

describe('mouse rotate', () => {
    test('MouseRotateHandler#isActive', () => {
        const map = createMap();
        const mouseRotate = map.handlers._handlersById.mouseRotate;

        // Prevent inertial rotation.
        jest.spyOn(browser, 'now').mockReturnValue(0);
        expect(mouseRotate.isActive()).toBe(false);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
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

    test('MouseRotateHandler#isActive #4622 regression test', () => {
        const map = createMap();
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
});
