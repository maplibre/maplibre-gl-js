import {describe, beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('pixel ratio defaults to devicePixelRatio', () => {
    const map = createMap();
    expect(map.getPixelRatio()).toBe(devicePixelRatio);
});

test('pixel ratio by default reflects devicePixelRatio changes', () => {
    global.devicePixelRatio = 0.25;
    const map = createMap();
    expect(map.getPixelRatio()).toBe(0.25);
    global.devicePixelRatio = 1;
    expect(map.getPixelRatio()).toBe(1);
});

test('painter has the expected size and pixel ratio', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    const map = createMap({container, pixelRatio: 2});
    expect(map.painter.pixelRatio).toBe(2);
    expect(map.painter.width).toBe(1024);
    expect(map.painter.height).toBe(1024);
});

test('canvas has the expected size', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    const map = createMap({container, pixelRatio: 2});
    expect(map.getCanvas().width).toBe(1024);
    expect(map.getCanvas().height).toBe(1024);
});

describe('setPixelRatio', () => {
    test('resizes canvas', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 1});
        expect(map.getCanvas().width).toBe(512);
        expect(map.getCanvas().height).toBe(512);
        map.setPixelRatio(2);
        expect(map.getCanvas().width).toBe(1024);
        expect(map.getCanvas().height).toBe(1024);
    });

    test('resizes painter', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 1});
        expect(map.painter.pixelRatio).toBe(1);
        expect(map.painter.width).toBe(512);
        expect(map.painter.height).toBe(512);
        map.setPixelRatio(2);
        expect(map.painter.pixelRatio).toBe(2);
        expect(map.painter.width).toBe(1024);
        expect(map.painter.height).toBe(1024);
    });
});

describe('getPixelRatio', () => {
    test('returns the pixel ratio', () => {
        const map = createMap({pixelRatio: 1});
        expect(map.getPixelRatio()).toBe(1);
        map.setPixelRatio(2);
        expect(map.getPixelRatio()).toBe(2);
    });
});

describe('canvas CSS size', () => {
    test('covers a whole number of device pixels at a fractional pixel ratio', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 988});
        Object.defineProperty(container, 'clientHeight', {value: 850});
        const map = createMap({container, pixelRatio: 1.75});
        const canvas = map.getCanvas();

        // 850 * 1.75 is 1487.5, so the backing store cannot match the container exactly.
        expect(canvas.height).toBe(1488);
        expect(parseFloat(canvas.style.width) * 1.75).toBe(canvas.width);
        expect(parseFloat(canvas.style.height) * 1.75).toBe(canvas.height);
        expect(map.painter.width).toBe(canvas.width);
        expect(map.painter.height).toBe(canvas.height);
    });

    test('keeps every device pixel at a pixel ratio just below a whole number', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 988});
        Object.defineProperty(container, 'clientHeight', {value: 850});
        // What a Wayland compositor at 200% reports: the float32 value below 2.
        const map = createMap({container, pixelRatio: 1.9999998807907104});
        const canvas = map.getCanvas();

        expect(canvas.width).toBe(1976);
        expect(canvas.height).toBe(1700);
        expect(map.painter.width).toBe(canvas.width);
        expect(map.painter.height).toBe(canvas.height);
    });
});
