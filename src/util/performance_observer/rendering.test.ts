import {describe, test, expect} from 'vitest';
import {RenderingPerformanceObserver} from './rendering';

describe('RenderingPerformanceObserver', () => {
    test('calculates performance metrics', () => {
        const observer = new RenderingPerformanceObserver();
        observer.observe('startOfFrame', 0);
        observer.observe('startOfFrame', 10);  // >60 fps
        observer.observe('startOfFrame', 20);  // >60 fps
        observer.observe('startOfFrame', 30);  // >60 fps

        const metrics = observer.takeRecords();

        expect(metrics.totalFramesCount).toBe(3);
        expect(metrics.virtualDroppedFramesCount).toBe(0);
        expect(metrics.lastFrameDurationMs).toBeCloseTo(10);
        expect(metrics.averageFramesPerSecond).toBeCloseTo(100);
    });

    test('detects dropped frames', () => {
        const observer = new RenderingPerformanceObserver();
        observer.observe('startOfFrame', 0);
        observer.observe('startOfFrame', 10); // >60 fps (good)
        observer.observe('startOfFrame', 50); // dropped frame
        observer.observe('startOfFrame', 100); // dropped frame

        const metrics = observer.takeRecords();

        expect(metrics.totalFramesCount).toBe(3);
        expect(metrics.virtualDroppedFramesCount).toBe(5);
    });

    test('disconnect clears metrics', () => {
        const observer = new RenderingPerformanceObserver();
        observer.observe('startOfFrame', 0);
        observer.observe('startOfFrame', 10);
        observer.observe('startOfFrame', 20);

        observer.disconnect();
        const metrics = observer.takeRecords();

        expect(metrics.totalFramesCount).toBe(0);
        expect(metrics.virtualDroppedFramesCount).toBe(0);
        expect(metrics.lastFrameDurationMs).toBeUndefined();
    });
});
