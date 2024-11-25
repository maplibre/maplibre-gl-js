import {beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('stops camera animation on touchstart when interactive', () => {
    const map = createMap({interactive: true});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.touchstart(map.getCanvasContainer(), {touches: [{target: map.getCanvas(), clientX: 0, clientY: 0}]});
    expect(map.isEasing()).toBe(false);

    map.remove();
});

test('continues camera animation on touchstart when non-interactive', () => {
    const map = createMap({interactive: false});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.touchstart(map.getCanvasContainer());
    expect(map.isEasing()).toBe(true);

    map.remove();
});

test('continues camera animation on resize', () => {
    const map = createMap(),
        container = map.getContainer();

    map.flyTo({center: [200, 0], duration: 100});

    Object.defineProperty(container, 'clientWidth', {value: 250});
    Object.defineProperty(container, 'clientHeight', {value: 250});
    map.resize();

    expect(map.isMoving()).toBeTruthy();

});

test('stops camera animation on mousedown when interactive', () => {
    const map = createMap({interactive: true});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.mousedown(map.getCanvasContainer());
    expect(map.isEasing()).toBe(false);

    map.remove();
});

test('continues camera animation on mousedown when non-interactive', () => {
    const map = createMap({interactive: false});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.mousedown(map.getCanvasContainer());
    expect(map.isEasing()).toBe(true);

    map.remove();
});
