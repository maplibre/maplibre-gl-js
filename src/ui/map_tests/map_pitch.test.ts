import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('setMinPitch', () => {
    const map = createMap({pitch: 20});
    map.setMinPitch(10);
    map.setPitch(0);
    expect(map.getPitch()).toBe(10);
});

test('unset minPitch', () => {
    const map = createMap({minPitch: 20});
    map.setMinPitch(null);
    map.setPitch(0);
    expect(map.getPitch()).toBe(0);
});

test('getMinPitch', () => {
    const map = createMap({pitch: 0});
    expect(map.getMinPitch()).toBe(0);
    map.setMinPitch(10);
    expect(map.getMinPitch()).toBe(10);
});

test('ignore minPitchs over maxPitch', () => {
    const map = createMap({pitch: 0, maxPitch: 10});
    expect(() => {
        map.setMinPitch(20);
    }).toThrow();
    map.setPitch(0);
    expect(map.getPitch()).toBe(0);
});

test('setMaxPitch', () => {
    const map = createMap({pitch: 0});
    map.setMaxPitch(10);
    map.setPitch(20);
    expect(map.getPitch()).toBe(10);
});

test('unset maxPitch', () => {
    const map = createMap({maxPitch: 10});
    map.setMaxPitch(null);
    map.setPitch(20);
    expect(map.getPitch()).toBe(20);
});

test('getMaxPitch', () => {
    const map = createMap({pitch: 0});
    expect(map.getMaxPitch()).toBe(60);
    map.setMaxPitch(10);
    expect(map.getMaxPitch()).toBe(10);
});

test('getAnisotropicFilterPitch default', () => {
    const map = createMap({});
    expect(map.getAnisotropicFilterPitch()).toBe(20);
});

test('getAnisotropicFilterPitch constructor option', () => {
    const map = createMap({anisotropicFilterPitch: 90});
    expect(map.getAnisotropicFilterPitch()).toBe(90);
});

test('setAnisotropicFilterPitch', () => {
    const map = createMap({});
    map.setAnisotropicFilterPitch(90);
    expect(map.getAnisotropicFilterPitch()).toBe(90);
});

test('setAnisotropicFilterPitch undefined', () => {
    const map = createMap({anisotropicFilterPitch: 90});
    map.setAnisotropicFilterPitch(undefined);
    expect(map.getAnisotropicFilterPitch()).toBe(20);
});

test('setAnisotropicFilterPitch null', () => {
    const map = createMap({anisotropicFilterPitch: 90});
    map.setAnisotropicFilterPitch(null);
    expect(map.getAnisotropicFilterPitch()).toBe(20);
});

test('ignore maxPitchs over minPitch', () => {
    const map = createMap({minPitch: 10});
    expect(() => {
        map.setMaxPitch(0);
    }).toThrow();
    map.setPitch(10);
    expect(map.getPitch()).toBe(10);
});

test('throw on maxPitch smaller than minPitch at init', () => {
    expect(() => {
        createMap({minPitch: 10, maxPitch: 5});
    }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
});

test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', () => {
    expect(() => {
        createMap({minPitch: 1, maxPitch: 0});
    }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
});

test('throw on maxPitch greater than valid maxPitch at init', () => {
    expect(() => {
        createMap({maxPitch: 190});
    }).toThrow(new Error('maxPitch must be less than or equal to 180'));
});

test('throw on minPitch less than valid minPitch at init', () => {
    expect(() => {
        createMap({minPitch: -10});
    }).toThrow(new Error('minPitch must be greater than or equal to 0'));
});

test('throw on anisotropicFilterPitch greater than valid maxPitch at init', () => {
    expect(() => {
        createMap({anisotropicFilterPitch: 190});
    }).toThrow(new Error('anisotropicFilterPitch must be less than or equal to 180'));
});

test('throw on anisotropicFilterPitch less than valid minPitch at init', () => {
    expect(() => {
        createMap({anisotropicFilterPitch: -10});
    }).toThrow(new Error('anisotropicFilterPitch must be greater than or equal to 0'));
});

test('fire move and pitch events when pitch is changed due to minPitch change', () => {
    const map = createMap({minPitch: 0, pitch: 10});
    const handleEvent = vi.fn();
    map.on('movestart', handleEvent);
    map.on('move', handleEvent);
    map.on('moveend', handleEvent);
    map.on('pitchstart', handleEvent);
    map.on('pitch', handleEvent);
    map.on('pitchend', handleEvent);
    map.setMinPitch(11);
    expect(map.getPitch()).toEqual(11);
    expect(map.getMinPitch()).toEqual(11);
    expect(handleEvent).toHaveBeenCalledTimes(6);
});

test('fire move and pitch events when pitch is changed due to maxPitch change', () => {
    const map = createMap({maxPitch: 20, pitch: 20});
    const handleEvent = vi.fn();
    map.on('movestart', handleEvent);
    map.on('move', handleEvent);
    map.on('moveend', handleEvent);
    map.on('pitchstart', handleEvent);
    map.on('pitch', handleEvent);
    map.on('pitchend', handleEvent);
    map.setMaxPitch(10);
    expect(map.getPitch()).toEqual(10);
    expect(map.getMaxPitch()).toEqual(10);
    expect(handleEvent).toHaveBeenCalledTimes(6);
});
