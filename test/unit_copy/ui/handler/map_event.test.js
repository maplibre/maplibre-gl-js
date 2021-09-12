import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../../../rollup/build/tsc/ui/map';
import DOM from '../../../../rollup/build/tsc/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({interactive: false, container: DOM.create('div', '', window.document.body)});
}

test('MapEvent handler fires touch events with correct values', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();

    const touchstart = t.spy();
    const touchmove = t.spy();
    const touchend = t.spy();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart.callCount).toBe(1);
    expect(touchstart.getCall(0).args[0].point).toEqual({x: 0, y: 50});
    expect(touchmove.callCount).toBe(0);
    expect(touchend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart.callCount).toBe(1);
    expect(touchmove.callCount).toBe(1);
    expect(touchmove.getCall(0).args[0].point).toEqual({x: 0, y: 60});
    expect(touchend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart.callCount).toBe(1);
    expect(touchmove.callCount).toBe(1);
    expect(touchend.callCount).toBe(1);
    expect(touchend.getCall(0).args[0].point).toEqual({x: 0, y: 60});

    map.remove();
    t.end();
});

test('MapEvent handler fires touchmove even while drag handler is active', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();
    map.dragPan.enable();

    const touchstart = t.spy();
    const touchmove = t.spy();
    const touchend = t.spy();
    const drag = t.spy();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);
    map.on('drag', drag);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart.callCount).toBe(1);
    expect(touchstart.getCall(0).args[0].point).toEqual({x: 0, y: 50});
    expect(touchmove.callCount).toBe(0);
    expect(touchend.callCount).toBe(0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart.callCount).toBe(1);
    expect(touchmove.callCount).toBe(1);
    expect(touchmove.getCall(0).args[0].point).toEqual({x: 0, y: 60});
    expect(touchend.callCount).toBe(0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart.callCount).toBe(1);
    expect(touchmove.callCount).toBe(1);
    expect(touchend.callCount).toBe(1);
    expect(touchend.getCall(0).args[0].point).toEqual({x: 0, y: 60});

    map._renderTaskQueue.run();
    expect(drag.callCount).toBe(1);

    map.remove();
    t.end();
});
