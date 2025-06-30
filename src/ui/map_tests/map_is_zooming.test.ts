import {describe, beforeEach, test, expect, vi, afterEach} from 'vitest';
import {browser} from '../../util/browser';
import {Map} from '../map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest} from '../../util/test/util';

function createMap() {
    return new Map({style: '', container: DOM.create('div', '', window.document.body)});
}

describe('Map.isZooming', () => {
    let map: Map;
    beforeEach(() => {
        beforeMapTest();
        map = createMap();
    });
    afterEach(() => {
        map.remove();
    });

    test('returns false by default', () => {
        expect(map.isZooming()).toBe(false);
    });

    test('returns true during a camera zoom animation', async () => {
        map.on('zoomstart', () => {
            expect(map.isZooming()).toBe(true);
        });

        const zoomEndPromise = map.once('zoomend');

        map.zoomTo(5, {duration: 0});
        await zoomEndPromise;
        expect(map.isZooming()).toBe(false);
    });

    test('returns true when scroll zooming', async () => {
        map.on('zoomstart', () => {
            expect(map.isZooming()).toBe(true);
        });

        const zoomEndPromise = map.once('zoomend');

        let now = 0;
        vi.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);

        await zoomEndPromise;
        expect(map.isZooming()).toBe(false);
    });

    test('returns true when double-click zooming', async () => {
        map.on('zoomstart', () => {
            expect(map.isZooming()).toBe(true);
        });

        const zoomEndPromise = map.once('zoomend');

        let now = 0;
        vi.spyOn(browser, 'now').mockImplementation(() => { return now; });

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        now += 500;
        map._renderTaskQueue.run();

        await zoomEndPromise;
        expect(map.isZooming()).toBe(false);
    });
});
