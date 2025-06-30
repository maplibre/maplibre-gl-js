import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {browser} from '../../util/browser';
import {Map} from '../map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
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

describe('Map.isMoving', () => {
    // MouseEvent.buttons
    const buttons = 1;

    test('returns false by default', () => {
        expect(map.isMoving()).toBe(false);
    });

    test('returns true during a camera zoom animation', async () => {
        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        const zoomEndPromise = map.once('zoomend');

        map.zoomTo(5, {duration: 0});

        await zoomEndPromise;
        expect(map.isMoving()).toBe(false);
    });

    test('returns true when drag panning', async () => {
        map.on('movestart', () => {
            expect(map.isMoving()).toBe(true);
        });
        map.on('dragstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('dragend', () => {
            expect(map.isMoving()).toBe(false);
        });
        const moveEndPromise = map.once('moveend');

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();

        await moveEndPromise;
        expect(map.isMoving()).toBe(false);
    });

    test('returns true when drag rotating', async () => {
        // Prevent inertial rotation.
        vi.spyOn(browser, 'now').mockImplementation(() => { return 0; });

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
        });

        const moveEndPromise = map.once('moveend');

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
        map._renderTaskQueue.run();

        await expect(moveEndPromise).resolves.toBeDefined();        
    });

    test('returns true when scroll zooming', async () => {
        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        const moveEndPromise = map.once('zoomend');

        let now = 0;
        vi.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);

        await moveEndPromise;
        expect(map.isMoving()).toBe(false);
    });

    test('returns true when drag panning and scroll zooming interleave', async () => {
        map.on('dragstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        map.on('zoomstart', () => {
            expect(map.isMoving()).toBe(true);
        });

        const zoomEndPromise = map.once('zoomend');

        map.on('dragend', () => {
            expect(map.isMoving()).toBe(false);
        });

        // The following should trigger the above events, where a zoomstart/zoomend
        // pair is nested within a dragstart/dragend pair.

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        let now = 0;
        vi.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);

        await zoomEndPromise;
        expect(map.isMoving()).toBe(true);
        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
    });
});
