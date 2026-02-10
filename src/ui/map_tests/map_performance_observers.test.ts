import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type IPerformanceObserver} from '../../util/performance_observer/observer';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map Performance Observers', () => {
    test('should call observer on map creation', () => {
        const observer: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        createMap({performanceObservers: [observer]});

        expect(observer.observe).toHaveBeenCalledWith('create', expect.any(Number));
    });

    test('should call observer on map load event', async () => {
        const observer: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const map = createMap({
            performanceObservers: [observer]
        });

        await map.once('load');

        expect(observer.observe).toHaveBeenCalledWith('load', expect.any(Number));
    });

    test('should call observer on fullLoad event', async () => {
        const observer: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const map = createMap({performanceObservers: [observer]});

        await map.once('load');

        // Wait for the map to be fully loaded (idle state)
        await new Promise<void>((resolve) => {
            const checkIdle = () => {
                if (map.isStyleLoaded() && map.areTilesLoaded()) {
                    resolve();
                } else {
                    map.once('idle', () => resolve());
                }
            };
            checkIdle();
        });

        expect(observer.observe).toHaveBeenCalledWith('fullLoad', expect.any(Number));
    });

    test('should call observer on startOfFrame event', async () => {
        const observer: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const map = createMap({performanceObservers: [observer]});

        await map.once('render');

        // Trigger a repaint which should trigger startOfFrame
        map.triggerRepaint();

        expect(observer.observe).toHaveBeenCalledWith('startOfFrame', expect.any(Number));
    });

    test('should support multiple observers', () => {
        const observer1: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const observer2: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        createMap({performanceObservers: [observer1, observer2]});

        expect(observer1.observe).toHaveBeenCalledWith('create', expect.any(Number));
        expect(observer2.observe).toHaveBeenCalledWith('create', expect.any(Number));
    });

    test('should call disconnect on all observers when map is removed', () => {
        const observer1: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const observer2: IPerformanceObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        const map = createMap({performanceObservers: [observer1, observer2]});
        map.remove();

        expect(observer1.disconnect).toHaveBeenCalledTimes(1);
        expect(observer2.disconnect).toHaveBeenCalledTimes(1);
    });
});
