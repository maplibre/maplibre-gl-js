import Map, {MapOptions} from '../map';
import DOM from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';

function createMap() {
    return new Map({interactive: false, container: DOM.create('div', '', window.document.body)} as any as MapOptions);
}

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

describe('map events', () => {
    test('MapEvent handler fires touch events with correct values', () => {
        const map = createMap();
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
});
