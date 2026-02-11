import {describe, test, expect} from 'vitest';
import {LivecyclePerformanceObserver} from './livecycle';

describe('LivecyclePerformanceObserver', () => {
    test('calculates performance metrics', () => {
        const observer = new LivecyclePerformanceObserver();
        observer.observe('create', 100);
        observer.observe('load', 250);
        observer.observe('fullLoad', 500);

        const metrics = observer.takeRecords();

        expect(metrics.loadTimeMs).toBe(150);
        expect(metrics.fullLoadTimeMs).toBe(400);
    });

    test('disconnect clears metrics', () => {
        const observer = new LivecyclePerformanceObserver();
        observer.observe('create', 100);
        observer.observe('load', 250);

        observer.disconnect();
        const metrics = observer.takeRecords();

        expect(metrics.loadTimeMs).toBeUndefined();
        expect(metrics.fullLoadTimeMs).toBeUndefined();
    });
});
