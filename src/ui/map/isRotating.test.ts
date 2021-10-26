import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../util/simulate_interaction';
import browser from '../../util/browser';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
}

describe('Map#isRotating returns false by default', done => {
    const map = createMap(t);
    expect(map.isRotating()).toBe(false);
    map.remove();
    done();
});

describe('Map#isRotating returns true during a camera rotate animation', done => {
    const map = createMap(t);

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

describe('Map#isRotating returns true when drag rotating', done => {
    const map = createMap(t);

    // Prevent inertial rotation.
    t.stub(browser, 'now').returns(0);

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
