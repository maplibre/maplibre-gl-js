import {browser} from '../../util/browser';
import {Map} from '../../ui/map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {setPerformance, beforeMapTest} from '../../util/test/util';

function createMap() {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        style: {
            'version': 8,
            'sources': {},
            'layers': []
        }
    });
}

beforeEach(() => {
    beforeMapTest();
});

describe('ScrollZoomHandler', () => {

    test('Zooms for single mouse wheel tick', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        const startZoom = map.getZoom();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        browserNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBeCloseTo(0.0285, 3);

        map.remove();
    });

    test('Zooms for single mouse wheel tick with non-magical deltaY', done => {
        const browserNow = jest.spyOn(browser, 'now');
        const now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // Simulate a single 'wheel' event without the magical deltaY value.
        // This requires the handler to briefly wait to see if a subsequent
        // event is coming in order to guess trackpad vs. mouse wheel
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -20});
        map.on('zoomstart', () => {
            map.remove();
            done();
        });
    });

    test('Zooms for multiple mouse wheel ticks', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();

        map._renderTaskQueue.run();
        const startZoom = map.getZoom();

        const events = [
            [2, {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta}],
            [7, {type: 'wheel', deltaY: -41}],
            [30, {type: 'wheel', deltaY: -169}],
            [1, {type: 'wheel', deltaY: -801}],
            [5, {type: 'wheel', deltaY: -326}],
            [20, {type: 'wheel', deltaY: -345}],
            [22, {type: 'wheel', deltaY: -376}],
        ] as [number, any][];

        const end = now + 500;
        let lastWheelEvent = now;

        // simulate the above sequence of wheel events, with render frames
        // interspersed every 20ms
        while (now  < end) {
            now += 1;
            browserNow.mockReturnValue(now);
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        expect(map.getZoom() - startZoom).toBeCloseTo(1.944, 3);

        map.remove();
    });

    test('Gracefully ignores wheel events with deltaY: 0', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();
        // simulate  shift+'wheel' events
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -0, shiftKey: true});
        map._renderTaskQueue.run();

        now += 400;
        browserNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBe(0.0);

    });

    test('Gracefully handle wheel events that cancel each other out before the first scroll frame', () => {
        // See also https://github.com/mapbox/mapbox-gl-js/issues/6782
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        now += 1;
        browserNow.mockReturnValue(now);
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 2});

        map._renderTaskQueue.run();

        now += 400;
        browserNow.mockReturnValue(now);
        map._renderTaskQueue.run();

    });

    test('does not zoom if preventDefault is called on the wheel event', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();

        map.on('wheel', e => e.preventDefault());

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        browserNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom()).toBe(0);

        map.remove();
    });

    test('emits one movestart event and one moveend event while zooming', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);
        jest.useFakeTimers();
        setPerformance();
        const map = createMap();

        let startCount = 0;
        map.on('movestart', () => {
            startCount += 1;
        });

        let endCount = 0;
        map.on('moveend', () => {
            endCount += 1;
        });

        const events = [
            [2, {type: 'trackpad', deltaY: -1}],
            [7, {type: 'trackpad', deltaY: -2}],
            [30, {type: 'wheel', deltaY: -5}]
        ] as [number, any][];

        const end = now + 50;
        let lastWheelEvent = now;

        while (now < end) {
            now += 1;
            browserNow.mockReturnValue(now);
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        jest.advanceTimersByTime(200);

        map._renderTaskQueue.run();

        expect(startCount).toBe(1);
        expect(endCount).toBe(1);

    });

    test('emits one zoomstart event and one zoomend event while zooming', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        jest.useFakeTimers();
        setPerformance();
        const map = createMap();

        let startCount = 0;
        map.on('zoomstart', () => {
            startCount += 1;
        });

        let endCount = 0;
        map.on('zoomend', () => {
            endCount += 1;
        });

        const events = [
            [2, {type: 'trackpad', deltaY: -1}],
            [7, {type: 'trackpad', deltaY: -2}],
            [30, {type: 'wheel', deltaY: -5}],
        ] as [number, any][];

        const end = now + 50;
        let lastWheelEvent = now;

        while (now < end) {
            now += 1;
            browserNow.mockReturnValue(now);
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        jest.advanceTimersByTime(200);
        map._renderTaskQueue.run();

        expect(startCount).toBe(1);
        expect(endCount).toBe(1);

    });

    test('Zooms for single mouse wheel tick while not in the center of the map and terrain is on, should zoom according to mouse position', () => {
        const browserNow = jest.spyOn(browser, 'now');
        let now = 1555555555555;
        browserNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();
        map.terrain = {
            pointCoordinate: () => null
        } as any;

        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: 1000, clientY: 1000});
        map._renderTaskQueue.run();

        now += 400;
        browserNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getCenter().lat).toBeCloseTo(-11.6371, 3);
        expect(map.getCenter().lng).toBeCloseTo(11.0286, 3);

        map.remove();
    });
});
