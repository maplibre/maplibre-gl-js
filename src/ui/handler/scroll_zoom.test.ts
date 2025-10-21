import {describe, beforeEach, test, expect, vi, type MockInstance} from 'vitest';
import * as timeControl from '../../util/time_control';
import {Map} from '../../ui/map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {setPerformance, beforeMapTest, createTerrain} from '../../util/test/util';

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

function scrollOutAtLat(map: Map, lat: number, timeControlNow: MockInstance<() => number>, deltaY: number = 5) {
    map.setCenter([0, lat]);
    map.setZoom(1);
    for (let i = 0; i < 200; i++) {
        simulate.wheel(map.getCanvas(), {
            type: 'wheel',
            deltaY,
            clientX: map.transform.width / 2,
            clientY: map.transform.height / 2});
        timeControlNow.mockReturnValue(timeControl.now() + 10);
        map._renderTaskQueue.run();
    }
}

beforeEach(() => {
    beforeMapTest();
});

describe('ScrollZoomHandler', () => {

    test('Zooms for single mouse wheel tick', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        const startZoom = map.getZoom();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBeCloseTo(0.0285, 3);

        map.remove();
    });

    test('Zooms for single mouse wheel tick with easing for smooth zooming', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map.setZoom(5);
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event
        const startZoom = map.getZoom();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        // A single tick zoom with easing completes in approx. 200ms
        now += 100;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const midZoom = map.getZoom();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoom = map.getZoom();

        expect(midZoom).toBeGreaterThan(startZoom);
        expect(midZoom).toBeLessThan(endZoom);

        map.remove();
    });

    test('Zooms for multiple fast mouse wheel ticks', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // simulate a multiple fast 'wheel' event
        const startZoom = map.getZoom();

        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
            map._renderTaskQueue.run();
            now += 0;
            timeControlNow.mockReturnValue(now);
            map._renderTaskQueue.run();
        }

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBeCloseTo(0.0285 * iterations, 2);

        map.remove();
    });

    test('Zooms for multiple fast mouse wheel ticks with easing for smooth zooming', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map.setZoom(5);
        map._renderTaskQueue.run();

        // simulate a multiple fast 'wheel' event
        const startZoom = map.getZoom();
        let midZoom = 0;

        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
            map._renderTaskQueue.run();
            now += 0;
            timeControlNow.mockReturnValue(now);
            map._renderTaskQueue.run();

            if (i === iterations - 1) {
                midZoom = map.getZoom();
            }
        }

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoom = map.getZoom();

        expect(midZoom).toBeGreaterThan(startZoom);
        expect(midZoom).toBeLessThan(endZoom);

        map.remove();
    });

    test('Zooms for single mouse wheel tick with non-magical deltaY', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        const now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // Simulate a single 'wheel' event without the magical deltaY value.
        // This requires the handler to briefly wait to see if a subsequent
        // event is coming in order to guess trackpad vs. mouse wheel
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -20});
        await map.once('zoomstart');
        map.remove();  
    });

    test('Zooms for single mouse wheel tick with non-magical deltaY with easing for smooth zooming', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);
        setPerformance();
        const map = createMap();
        map.setZoom(5);
        map._renderTaskQueue.run();

        const startZoom = map.getZoom();

        // simulate a single 'wheel' event with non-magical deltaY
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -20});
        await map.once('zoom');
        now += 40;
        map._renderTaskQueue.run();

        // A single tick zoom with easing completes in approx. 200ms
        now += 100;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const midZoom = map.getZoom();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoom = map.getZoom();

        expect(midZoom).toBeGreaterThan(startZoom);
        expect(midZoom).toBeLessThan(endZoom);

        map.remove();
    });

    test('Zooms for multiple mouse wheel ticks', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        // simulate 3 'wheel' events
        const startZoom = map.getZoom();

        now += 2;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 7;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 30;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBeCloseTo(0.0285 * 3, 3);

        map.remove();
    });

    test('Zooms for multiple mouse wheel ticks with easing for smooth zooming', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map.setZoom(5);
        map._renderTaskQueue.run();

        // simulate 3 'wheel' events
        // Event 1 Start
        now += 2;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        const startZoomEvent1 = map.getZoom();
        map._renderTaskQueue.run();

        // Event 1 mid-zoom
        now += 3;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const midZoomEvent1 = map.getZoom();

        // Event 2 Start
        now += 4;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoomEvent1 = map.getZoom();
        const startZoomEvent2 = map.getZoom();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        // Event 2 mid-zoom
        now += 15;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const midZoomEvent2 = map.getZoom();

        // Event 3 Start
        now += 15;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoomEvent2 = map.getZoom();
        const startZoomEvent3 = map.getZoom();
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        // Event 3 mid-zoom
        // A single tick zoom with easing completes in approx. 200ms
        now += 100;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const midZoomEvent3 = map.getZoom();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();
        const endZoomEvent3 = map.getZoom();

        expect(midZoomEvent1).toBeGreaterThan(startZoomEvent1);
        expect(midZoomEvent1).toBeLessThan(endZoomEvent1);

        expect(midZoomEvent2).toBeGreaterThan(startZoomEvent2);
        expect(midZoomEvent2).toBeLessThan(endZoomEvent2);

        expect(midZoomEvent3).toBeGreaterThan(startZoomEvent3);
        expect(midZoomEvent3).toBeLessThan(endZoomEvent3);

        map.remove();
    });

    test('Gracefully ignores wheel events with deltaY: 0', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

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
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom() - startZoom).toBe(0.0);

        map.remove();
    });

    test('Gracefully handle wheel events that cancel each other out before the first scroll frame', () => {
        // See also https://github.com/mapbox/mapbox-gl-js/issues/6782
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -1});
        now += 1;
        timeControlNow.mockReturnValue(now);
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: 2});

        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        map.remove();
    });

    test('does not zoom if preventDefault is called on the wheel event', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();

        map.on('wheel', e => e.preventDefault());

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getZoom()).toBe(0);

        map.remove();
    });

    test('emits one movestart event and one moveend event while zooming', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);
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
            timeControlNow.mockReturnValue(now);
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        await map.once('zoomend');

        map._renderTaskQueue.run();

        expect(startCount).toBe(1);
        expect(endCount).toBe(1);

        map.remove();
    });

    test('emits one zoomstart event and one zoomend event while zooming', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

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
            timeControlNow.mockReturnValue(now);
            if (events.length && lastWheelEvent + events[0][0] === now) {
                const [, event] = events.shift();
                simulate.wheel(map.getCanvas(), event);
                lastWheelEvent = now;
            }
            if (now % 20 === 0) {
                map._renderTaskQueue.run();
            }
        }

        await map.once('zoomend');
        map._renderTaskQueue.run();

        expect(startCount).toBe(1);
        expect(endCount).toBe(1);

        map.remove();
    });

    test('Zooms for single mouse wheel tick while in the center of the map, should zoom to center', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._renderTaskQueue.run();
        expect(map.getCenter().lat).toBeCloseTo(0, 10);
        expect(map.getCenter().lng).toBeCloseTo(0, 10);

        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: 200, clientY: 150});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getCenter().lat).toBeCloseTo(0, 10);
        expect(map.getCenter().lng).toBeCloseTo(0, 10);
        expect(map.getZoom()).toBeCloseTo(0.028567106927402726, 10);

        map.remove();
    });

    test('Zooms for single mouse wheel tick while not in the center of the map, should zoom according to mouse position', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._elevateCameraIfInsideTerrain = (_tr : any) => ({});
        map._renderTaskQueue.run();
        map.terrain = createTerrain();

        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: 1000, clientY: 1000});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getCenter().lat).toBeCloseTo(-11.6371, 3);
        expect(map.getCenter().lng).toBeCloseTo(11.0286, 3);
        expect(map.getZoom()).toBeCloseTo(0.028567106927402726, 10);

        map.remove();
    });

    test('Zooms for single mouse wheel tick while not in the center of the map and terrain is on, should zoom according to mouse position', () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        const map = createMap();
        map._elevateCameraIfInsideTerrain = (_tr : any) => ({});
        map._renderTaskQueue.run();
        map.terrain = createTerrain();

        // simulate a single 'wheel' event
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: 1000, clientY: 1000});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getCenter().lat).toBeCloseTo(-11.6371, 3);
        expect(map.getCenter().lng).toBeCloseTo(11.0286, 3);

        map.remove();
    });

    test('Terrain 3D zoom is in the same direction when pointing above horizon or under horizon', () => {
        // See also https://github.com/maplibre/maplibre-gl-js/issues/3398
        const timeControlNow = vi.spyOn(timeControl, 'now');
        let now = 1555555555555;
        timeControlNow.mockReturnValue(now);

        let map = createMap();
        map._elevateCameraIfInsideTerrain = (_tr : any) => ({});
        map._renderTaskQueue.run();
        map.terrain = createTerrain();
        map.setZoom(5);
        map.setMaxPitch(85);
        map.setPitch(80);
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event on top of screen
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: map.getCanvas().width / 2, clientY: 10});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        // On Top, use center point
        expect(map.getCenter().lat).toBeCloseTo(0, 3);
        expect(map.getCenter().lng).toBeCloseTo(0, 3);
        expect(map.getZoom()).toBeCloseTo(5.02856, 3);
        map.remove();

        // do the same test on the bottom
        map = createMap();
        map._elevateCameraIfInsideTerrain = (_tr : any) => ({});
        map._renderTaskQueue.run();
        map.terrain = createTerrain();
        map.setZoom(5);
        map.setMaxPitch(85);
        map.setPitch(80);
        map._renderTaskQueue.run();

        // simulate a single 'wheel' event on bottom of screen
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, clientX: map.getCanvas().width / 2, clientY: map.getCanvas().height - 10});
        map._renderTaskQueue.run();

        now += 400;
        timeControlNow.mockReturnValue(now);
        map._renderTaskQueue.run();

        expect(map.getCenter().lat).toBeCloseTo(-0.125643, 3);
        expect(map.getCenter().lng).toBeCloseTo(0.0, 3);
        expect(map.getZoom()).toBeCloseTo(5.02856, 3);

        map.remove();
    });

    test('Clamps zoom at high latitude to keep globe consistent size', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        const map = createMap();
        await map.once('load');

        map.setProjection({type: 'globe'});
        map.setMinZoom(0);

        scrollOutAtLat(map, 80, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(-2.53, 2);
        scrollOutAtLat(map, -80, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(-2.53, 2);
        scrollOutAtLat(map, 0, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(0, 2);

        map.remove();
    });

    test('Clamps zoom at high latitude to keep globe consistent size using mouse wheel', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        const map = createMap();
        await map.once('load');

        map.setProjection({type: 'globe'});
        map.setMinZoom(0);

        scrollOutAtLat(map, 80, timeControlNow, simulate.magicWheelZoomDelta);
        expect(map.getZoom()).toBeCloseTo(-2.53, 2);
        scrollOutAtLat(map, -80, timeControlNow, simulate.magicWheelZoomDelta);
        expect(map.getZoom()).toBeCloseTo(-2.53, 2);
        scrollOutAtLat(map, 0, timeControlNow, simulate.magicWheelZoomDelta);
        expect(map.getZoom()).toBeCloseTo(0, 2);

        map.remove();
    });

    test('Clamps to min/max zoom when using mercator projection', async () => {
        const timeControlNow = vi.spyOn(timeControl, 'now');
        const map = createMap();
        await map.once('load');

        map.setProjection({type: 'mercator'});
        map.setMinZoom(0);

        scrollOutAtLat(map, 80, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(0, 2);
        scrollOutAtLat(map, -80, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(0, 2);
        scrollOutAtLat(map, 0, timeControlNow);
        expect(map.getZoom()).toBeCloseTo(0, 2);

        map.remove();
    });
});
