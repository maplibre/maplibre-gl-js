import {Map} from '../map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {browser} from '../../util/browser';
import {beforeMapTest} from '../../util/test/util';

let map;

function createMap() {
    return new Map({style: '', container: DOM.create('div', '', window.document.body)});
}

beforeEach(() => {
    beforeMapTest();
    map = createMap();
});

afterEach(() => {
    map.remove();
});

describe('Map#isRotating', () => {
    test('returns false by default', () => {
        expect(map.isRotating()).toBe(false);
    });

    test('returns true during a camera rotate animation', () => new Promise<void>(done => {
        map.on('rotatestart', () => {
            expect(map.isRotating()).toBe(true);
        });

        map.on('rotateend', () => {
            expect(map.isRotating()).toBe(false);
            done();
        });

        map.rotateTo(5, {duration: 0});
    }));

    test('returns true when drag rotating', () => new Promise<void>(done => {
        // Prevent inertial rotation.
        jest.spyOn(browser, 'now').mockImplementation(() => { return 0; });

        map.on('rotatestart', () => {
            expect(map.isRotating()).toBe(true);
        });

        map.on('rotateend', () => {
            expect(map.isRotating()).toBe(false);
            done();
        });

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
        map._renderTaskQueue.run();
    }));
});
