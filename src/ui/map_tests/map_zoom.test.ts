import {beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest, createTerrain} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('#setMinZoom', () => {
    const map = createMap({zoom: 5});
    map.setMinZoom(3.5);
    map.setZoom(1);
    expect(map.getZoom()).toBe(3.5);
});

test('unset minZoom', () => {
    const map = createMap({minZoom: 5});
    map.setMinZoom(null);
    map.setZoom(1);
    expect(map.getZoom()).toBe(1);
});

test('#getMinZoom', () => {
    const map = createMap({zoom: 0});
    expect(map.getMinZoom()).toBe(-2);
    map.setMinZoom(10);
    expect(map.getMinZoom()).toBe(10);
});

test('ignore minZooms over maxZoom', () => {
    const map = createMap({zoom: 2, maxZoom: 5});
    expect(() => {
        map.setMinZoom(6);
    }).toThrow();
    map.setZoom(0);
    expect(map.getZoom()).toBe(0);
});

test('#setMaxZoom', () => {
    const map = createMap({zoom: 0});
    map.setMaxZoom(3.5);
    map.setZoom(4);
    expect(map.getZoom()).toBe(3.5);
});

test('unset maxZoom', () => {
    const map = createMap({maxZoom: 5});
    map.setMaxZoom(null);
    map.setZoom(6);
    expect(map.getZoom()).toBe(6);
});

test('#getMaxZoom', () => {
    const map = createMap({zoom: 0});
    expect(map.getMaxZoom()).toBe(22);
    map.setMaxZoom(10);
    expect(map.getMaxZoom()).toBe(10);
});

test('ignore maxZooms over minZoom', () => {
    const map = createMap({minZoom: 5});
    expect(() => {
        map.setMaxZoom(4);
    }).toThrow();
    map.setZoom(5);
    expect(map.getZoom()).toBe(5);
});

test('throw on maxZoom smaller than minZoom at init', () => {
    expect(() => {
        createMap({minZoom: 10, maxZoom: 5});
    }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
});

test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
    expect(() => {
        createMap({minZoom: 1, maxZoom: 0});
    }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
});

test('recalculate zoom is done on the camera update transform', async () => {
    const map = createMap({
        interactive: true,
        clickTolerance: 4,
        transformCameraUpdate: ({zoom}) => ({zoom: zoom + 0.1})
    });
    await map.once('style.load');
    map.terrain = createTerrain();
    const canvas = map.getCanvas();
    simulate.dragWithMove(canvas, {x: 100, y: 100}, {x: 100, y: 150});
    map._renderTaskQueue.run();
    expect(map.getZoom()).toBeCloseTo(0.20007702699730118, 10);
});
