import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {createMap as globalCreateMap, beforeMapTest} from '../../util/test/util';
import {NavigationControl} from './navigation_control';

function createMap() {
    return globalCreateMap({});
}

let map;

beforeEach(() => {
    beforeMapTest();
    map = createMap();
});

afterEach(() => {
    map.remove();
});

describe('NavigationControl', () => {
    test('appears in the top-right', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-right > .maplibregl-ctrl')
        ).toHaveLength(1);
    });

    test('contains zoom in button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-zoom-in')
        ).toHaveLength(1);
    });

    test('contains zoom out button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-zoom-out')
        ).toHaveLength(1);
    });

    test('contains compass button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-compass')
        ).toHaveLength(1);
    });

    test('compass button reset action', () => {
        map.setPitch(10);
        map.setBearing(10);

        map.addControl(new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        }));
        const spyReset = vi.spyOn(map, 'resetNorthPitch');
        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');

        simulate.click(navButton);
        map._renderTaskQueue.run();

        expect(spyReset).toHaveBeenCalledTimes(1);
    });

    test('compass button drag horizontal', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2 - 1;

        simulate.mousedown(navButton, {buttons: 1, button: 0, clientX: buttonX, clientY: buttonY});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX - 50, clientY: buttonY});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX - 100, clientY: buttonY});
        simulate.mouseup(window,   {button: 0, clientX: buttonX - 100, clientY: buttonY});

        map._renderTaskQueue.run();

        expect(spySetPitch).not.toHaveBeenCalled();
        expect(spySetBearing).toHaveBeenCalled();
    });

    test('compass button drag vertical', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2;

        simulate.mousedown(navButton, {buttons: 1, button: 0, clientX: buttonX, clientY: buttonY});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX, clientY: buttonY - 50});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX, clientY: buttonY - 100});
        simulate.mouseup(window,   {button: 0, clientX: buttonX, clientY: buttonY - 100});

        map._renderTaskQueue.run();

        expect(spySetPitch).toHaveBeenCalled();
        expect(spySetBearing).not.toHaveBeenCalled();
    });

    test('compass button drag diagonal', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2;

        simulate.mousedown(navButton, {buttons: 1, button: 0, clientX: buttonX, clientY: buttonY});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX - 50, clientY: buttonY - 50});
        simulate.mousemove(window, {buttons: 1, button: 0, clientX: buttonX - 100, clientY: buttonY - 100});
        simulate.mouseup(window,   {button: 0, clientX: buttonX - 100, clientY: buttonY - 100});

        map._renderTaskQueue.run();

        expect(spySetPitch).toHaveBeenCalled();
        expect(spySetBearing).toHaveBeenCalled();
    });

    test('compass button touch drag horizontal', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2 - 1;

        simulate.touchstart(navButton, {touches: [{clientX: buttonX, clientY: buttonY}], targetTouches: [{clientX: buttonX, clientY: buttonY}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX - 50, clientY: buttonY}], targetTouches: [{clientX: buttonX - 50, clientY: buttonY}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX - 100, clientY: buttonY}], targetTouches: [{clientX: buttonX - 100, clientY: buttonY}]});
        simulate.touchend(window);

        map._renderTaskQueue.run();

        expect(spySetPitch).not.toHaveBeenCalled();
        expect(spySetBearing).toHaveBeenCalled();
    });

    test('compass button touch drag vertical', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2;

        simulate.touchstart(navButton, {touches: [{clientX: buttonX, clientY: buttonY}], targetTouches: [{clientX: buttonX, clientY: buttonY}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX, clientY: buttonY - 50}], targetTouches: [{clientX: buttonX, clientY: buttonY - 50}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX, clientY: buttonY - 100}], targetTouches: [{clientX: buttonX, clientY: buttonY - 100}]});
        simulate.touchend(window);

        map._renderTaskQueue.run();

        expect(spySetPitch).toHaveBeenCalled();
        expect(spySetBearing).not.toHaveBeenCalled();
    });

    test('compass button touch drag diagonal', () => {
        const navControl = new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        });
        map.addControl(navControl);

        const spySetPitch = vi.spyOn(map, 'setPitch');
        const spySetBearing = vi.spyOn(map, 'setBearing');

        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');
        const navRect = navButton.getClientRects();

        const buttonX = (navRect.x ?? 0) + (navRect.width ?? 0) / 2;
        const buttonY = (navRect.y ?? 0) + (navRect.height ?? 0) / 2;

        simulate.touchstart(navButton, {touches: [{clientX: buttonX, clientY: buttonY}], targetTouches: [{clientX: buttonX, clientY: buttonY}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX - 50, clientY: buttonY - 50}], targetTouches: [{clientX: buttonX - 50, clientY: buttonY - 50}]});
        simulate.touchmove(window, {touches: [{clientX: buttonX - 100, clientY: buttonY - 100}], targetTouches: [{clientX: buttonX - 100, clientY: buttonY - 100}]});
        simulate.touchend(window);

        map._renderTaskQueue.run();

        expect(spySetPitch).toHaveBeenCalled();
        expect(spySetBearing).toHaveBeenCalled();
    });
});
