import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {FullscreenControl} from './fullscreen_control';

beforeEach(() => {
    beforeMapTest();
});

describe('FullscreenControl', () => {
    test('renders control', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });
        const map = createMap();
        const fullscreen = new FullscreenControl({});
        map.addControl(fullscreen);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen')).toHaveLength(1);
    });

    test('makes optional container element full screen', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });

        const map = createMap();
        const container = window.document.querySelector('body')!;
        const fullscreen = new FullscreenControl({container});
        map.addControl(fullscreen);

        const click = new window.Event('click');
        fullscreen._fullscreenButton.dispatchEvent(click);

        expect(fullscreen._container.tagName).toBe('BODY');
    });

    test('uses pseudo fullscreen when fullscreen is not supported', () => {
        const map = createMap();
        const mapContainer = map.getContainer();

        const fullscreen = new FullscreenControl({});
        map.addControl(fullscreen);

        const click = new window.Event('click');

        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);

        fullscreen._fullscreenButton.dispatchEvent(click);

        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);

        fullscreen._fullscreenButton.dispatchEvent(click);

        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
    });

    test('start and end events fire for fullscreen button clicks', () => {
        const map = createMap();
        const fullscreen = new FullscreenControl({});

        const fullscreenstart = vi.fn();
        const fullscreenend   = vi.fn();

        fullscreen.on('fullscreenstart', fullscreenstart);
        fullscreen.on('fullscreenend', fullscreenend);

        map.addControl(fullscreen);

        const click = new window.Event('click');

        // Simulate a click to the fullscreen button
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(fullscreenstart).toHaveBeenCalled();
        expect(fullscreenend).not.toHaveBeenCalled();

        // Second simulated click would exit fullscreen mode
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(fullscreenend).toHaveBeenCalled();
    });

    test('disables cooperative gestures when fullscreen becomes active', () => {
        const cooperativeGestures = true;
        const map = createMap({cooperativeGestures});
        const fullscreen = new FullscreenControl({});

        map.addControl(fullscreen);

        const click = new window.Event('click');

        // Simulate a click to the fullscreen button
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(map.cooperativeGestures.isEnabled()).toBeFalsy();

        // Second simulated click would exit fullscreen mode
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(map.cooperativeGestures.isEnabled()).toBeTruthy();
    });

    test('if never set, cooperative gestures remain disabled when fullscreen exits', () => {
        const map = createMap({cooperativeGestures: false});
        const fullscreen = new FullscreenControl({});

        map.addControl(fullscreen);

        const click = new window.Event('click');

        // Simulate a click to the fullscreen button
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(map.cooperativeGestures.isEnabled()).toBeFalsy();

        // Second simulated click would exit fullscreen mode
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(map.cooperativeGestures.isEnabled()).toBeFalsy();
    });

    test('uses pseudo fullscreen when pseudo option is true', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });

        const map = createMap();
        const mapContainer = map.getContainer();

        const fullscreen = new FullscreenControl({pseudo: true});
        map.addControl(fullscreen);

        const click = new window.Event('click');

        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
    });

    test('pseudo option forces pseudo fullscreen even when native fullscreen is available', () => {
        const map = createMap();
        const mapContainer = map.getContainer();

        // Mock requestFullscreen to verify it's NOT called when pseudo is true
        const requestFullscreenSpy = vi.fn();
        mapContainer.requestFullscreen = requestFullscreenSpy;

        const fullscreen = new FullscreenControl({pseudo: true});
        map.addControl(fullscreen);

        const click = new window.Event('click');
        fullscreen._fullscreenButton.dispatchEvent(click);

        expect(requestFullscreenSpy).not.toHaveBeenCalled();
        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);
    });

    test('pseudo fullscreen can be used on custom container', () => {
        const map = createMap();
        const container = window.document.querySelector('body')!;

        // Ensure container is clean before test
        container.classList.remove('maplibregl-pseudo-fullscreen');

        const fullscreen = new FullscreenControl({container, pseudo: true});
        map.addControl(fullscreen);

        const click = new window.Event('click');

        expect(container.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(container.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);
        expect(fullscreen._container.tagName).toBe('BODY');
        fullscreen._fullscreenButton.dispatchEvent(click);
        expect(container.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
    });
});
