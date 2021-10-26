import browser from '../../util/browser';
import Map from '../map';
import DOM from '../../util/dom';
import simulate from '../../../test/util/simulate_interaction';
import {setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';

function createMap() {
    return new Map({style: '', container: DOM.create('div', '', window.document.body)});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
});

describe('Map#isMoving', () => {

    // MouseEvent.buttons
    const buttons = 1;

    test('returns false by default', () => {
        const map = createMap();

        expect(map.isMoving()).toBe(false);
        map.remove();
    });

    test('returns true during a camera zoom animation', done => {
        const map = createMap();

        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('zoomend', () => {
            expect(map.isMoving()).toBe(false);
            map.remove();
            done();
        });

        map.zoomTo(5, {duration: 0});
    });

    test('returns true when drag panning', done => {
        const map = createMap();

        map.on('movestart', () => {
            expect(map.isMoving()).toBe(true);
        });
        map.on('dragstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('dragend', () => {
            expect(map.isMoving()).toBe(false);
        });
        map.on('moveend', () => {
            expect(map.isMoving()).toBe(false);
            map.remove();
            done();
        });

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
    });

    test('returns true when drag rotating', done => {
        const map = createMap();

        // Prevent inertial rotation.
        jest.spyOn(browser, 'now').mockImplementation(() => { return 0; });

        map.on('movestart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('rotatestart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('rotateend', () => {
            expect(map.isMoving()).toBe(false);
        });

        map.on('moveend', () => {
            expect(map.isMoving()).toBe(false);
            map.remove();
            done();
        });

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
        map._renderTaskQueue.run();
    });

    test('returns true when scroll zooming', done => {
        const map = createMap();

        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('zoomend', () => {
            expect(map.isMoving()).toBe(false);
            map.remove();
            done();
        });

        let now = 0;
        jest.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);
    });

    test('returns true when drag panning and scroll zooming interleave', done => {
        const map = createMap();

        map.on('dragstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('zoomend', () => {
            expect(map.isMoving()).toBe(true);
            simulate.mouseup(map.getCanvas());
            setTimeout(() => {
                map._renderTaskQueue.run();
                done();
            });
        });

        map.on('dragend', () => {
            expect(map.isMoving()).toBe(false);
            map.remove();
        });

        // The following should trigger the above events, where a zoomstart/zoomend
        // pair is nested within a dragstart/dragend pair.

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        let now = 0;
        jest.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);
    });
});
