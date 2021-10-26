import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../test/util/simulate_interaction';
import browser from '../../util/browser';
import {setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';

function createMap() {
    return new Map({style: '', container: DOM.create('div', '', window.document.body)});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
});

describe('Map#isRotating', () => {
    test('returns false by default', done => {
        const map = createMap();
        expect(map.isRotating()).toBe(false);
        map.remove();
        done();
    });

    test('returns true during a camera rotate animation', done => {
        const map = createMap();

        map.on('rotatestart', () => {
            expect(map.isRotating()).toBe(true);
        });

        map.on('rotateend', () => {
            expect(map.isRotating()).toBe(false);
            map.remove();
            done();
        });

        map.rotateTo(5, {duration: 0});
    });

    test('returns true when drag rotating', done => {
        const map = createMap();

        // Prevent inertial rotation.
        jest.spyOn(browser, 'now').mockImplementation(() => { return 0; });

        map.on('rotatestart', () => {
            expect(map.isRotating()).toBe(true);
        });

        map.on('rotateend', () => {
            expect(map.isRotating()).toBe(false);
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
});
