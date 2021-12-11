import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({interactive: false, container: DOM.create('div', '', window.document.body)});
}

describe('MapEvent handler fires touch events with correct values', () => {
    const map = createMap(t);
    const target = map.getCanvas();

    const touchstart = jest.fn();
    const touchmove = jest.fn();
    const touchend = jest.fn();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchstart.getCall(0).args[0].point).toEqual({x: 0, y: 50});
    expect(touchmove).toHaveBeenCalledTimes(0);
    expect(touchend).toHaveBeenCalledTimes(0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchmove.getCall(0).args[0].point).toEqual({x: 0, y: 60});
    expect(touchend).toHaveBeenCalledTimes(0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchend).toHaveBeenCalledTimes(1);
    expect(touchend.getCall(0).args[0].point).toEqual({x: 0, y: 60});

    map.remove();
});

describe('MapEvent handler fires touchmove even while drag handler is active', () => {
    const map = createMap(t);
    const target = map.getCanvas();
    map.dragPan.enable();

    const touchstart = jest.fn();
    const touchmove = jest.fn();
    const touchend = jest.fn();
    const drag = jest.fn();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);
    map.on('drag', drag);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchstart.getCall(0).args[0].point).toEqual({x: 0, y: 50});
    expect(touchmove).toHaveBeenCalledTimes(0);
    expect(touchend).toHaveBeenCalledTimes(0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchmove.getCall(0).args[0].point).toEqual({x: 0, y: 60});
    expect(touchend).toHaveBeenCalledTimes(0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchend).toHaveBeenCalledTimes(1);
    expect(touchend.getCall(0).args[0].point).toEqual({x: 0, y: 60});

    map._renderTaskQueue.run();
    expect(drag).toHaveBeenCalledTimes(1);

    map.remove();
});
