import {createMap, beforeMapTest} from '../../util/test/util';

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
