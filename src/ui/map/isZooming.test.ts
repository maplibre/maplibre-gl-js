import browser from '../../util/browser';
import Map from '../../ui/map';
import DOM from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';

function createMap() {
    return new Map({style: '', container: DOM.create('div', '', window.document.body)});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
});

describe('Map#isZooming', () => {

    test('returns false by default', done => {
        const map = createMap();
        expect(map.isZooming()).toBe(false);
        map.remove();
        done();
    });

    test('returns true during a camera zoom animation', done => {
        const map = createMap();

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

    test('returns true when scroll zooming', done => {
        const map = createMap();

        map.on('zoomstart', () => {
            expect(map.isZooming()).toBe(true);
        });

        map.on('zoomend', () => {
            expect(map.isZooming()).toBe(false);
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

    test('returns true when double-click zooming', done => {
        const map = createMap();

        map.on('zoomstart', () => {
            expect(map.isZooming()).toBe(true);
        });

        map.on('zoomend', () => {
            expect(map.isZooming()).toBe(false);
            map.remove();
            done();
        });

        let now = 0;
        jest.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        now += 500;
        map._renderTaskQueue.run();
    });
});
