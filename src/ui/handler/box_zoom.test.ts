import Map from '../map';
import DOM from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';

function createMap(clickTolerance) {
    return new Map({style: '', container: DOM.create('div', '', window.document.body), clickTolerance});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
});

describe('BoxZoomHandler', () => {
    test('fires boxzoomstart and boxzoomend events at appropriate times', () => {
        const map = createMap(undefined);

        const boxzoomstart = jest.fn();
        const boxzoomend   = jest.fn();

        map.on('boxzoomstart', boxzoomstart);
        map.on('boxzoomend',   boxzoomend);

        simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();
        expect(boxzoomstart).toHaveBeenCalledTimes(1);
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();
        expect(boxzoomstart).toHaveBeenCalledTimes(1);
        expect(boxzoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('avoids conflicts with DragPanHandler when disabled and reenabled (#2237)', () => {
        const map = createMap(undefined);

        map.boxZoom.disable();
        map.boxZoom.enable();

        const boxzoomstart = jest.fn();
        const boxzoomend   = jest.fn();

        map.on('boxzoomstart', boxzoomstart);
        map.on('boxzoomend',   boxzoomend);

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();
        expect(boxzoomstart).toHaveBeenCalledTimes(1);
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();
        expect(boxzoomstart).toHaveBeenCalledTimes(1);
        expect(boxzoomend).toHaveBeenCalledTimes(1);

        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        map.remove();
    });

    test('does not begin a box zoom if preventDefault is called on the mousedown event', () => {
        const map = createMap(undefined);

        map.on('mousedown', e => e.preventDefault());

        const boxzoomstart = jest.fn();
        const boxzoomend   = jest.fn();

        map.on('boxzoomstart', boxzoomstart);
        map.on('boxzoomend',   boxzoomend);

        simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
        map._renderTaskQueue.run();

        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        map.remove();
    });

    test('does not begin a box zoom on spurious mousemove events', () => {
        const map = createMap(undefined);

        const boxzoomstart = jest.fn();
        const boxzoomend   = jest.fn();

        map.on('boxzoomstart', boxzoomstart);
        map.on('boxzoomend',   boxzoomend);

        simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        map.remove();
    });

    test('does not begin a box zoom until mouse move is larger than click tolerance', () => {
        const map = createMap(4);

        const boxzoomstart = jest.fn();
        const boxzoomend   = jest.fn();

        map.on('boxzoomstart', boxzoomstart);
        map.on('boxzoomend',   boxzoomend);

        simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 3, clientY: 0});
        map._renderTaskQueue.run();
        expect(boxzoomstart).not.toHaveBeenCalled();
        expect(boxzoomend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 4});
        map._renderTaskQueue.run();
        expect(boxzoomstart).toHaveBeenCalledTimes(1);
        expect(boxzoomend).not.toHaveBeenCalled();

        map.remove();
    });
});
