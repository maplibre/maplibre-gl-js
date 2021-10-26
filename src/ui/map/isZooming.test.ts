import '../../../stub_loader';
import {test} from '../../../util/test';
import browser from '../../util/browser';
import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
}

describe('Map#isZooming returns false by default', done => {
    const map = createMap(t);
    expect(map.isZooming()).toBe(false);
    map.remove();
    done();
});

describe('Map#isZooming returns true during a camera zoom animation', done => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        expect(map.isZooming()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isZooming()).toBe(false);
        map.remove();
        done();
    });

    map.zoomTo(5, {duration: 0});
});

describe('Map#isZooming returns true when scroll zooming', done => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        expect(map.isZooming()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isZooming()).toBe(false);
        map.remove();
        done();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});

describe('Map#isZooming returns true when double-click zooming', done => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        expect(map.isZooming()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isZooming()).toBe(false);
        map.remove();
        done();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    now += 500;
    map._renderTaskQueue.run();
});
