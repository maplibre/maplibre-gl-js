import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {PerformanceMonitor, RequestPerformance} from './performance';
import type {RequestParameters} from './ajax';

describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
        monitor = new PerformanceMonitor();
    });

    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    describe('mark', () => {
        test('marks create event', () => {
            const markSpy = vi.spyOn(performance, 'mark');

            monitor.mark('create');

            expect(markSpy).toHaveBeenCalledWith(expect.stringContaining('create-'));

            markSpy.mockRestore();
        });

        test('marks load event', () => {
            const markSpy = vi.spyOn(performance, 'mark');

            monitor.mark('load');

            expect(markSpy).toHaveBeenCalledWith(expect.stringContaining('load-'));

            markSpy.mockRestore();
        });

        test('marks fullLoad event and measures load times', () => {
            const markSpy = vi.spyOn(performance, 'mark');
            const measureSpy = vi.spyOn(performance, 'measure');

            monitor.mark('create');
            monitor.mark('load');
            monitor.mark('fullLoad');

            expect(markSpy).toHaveBeenCalledWith(expect.stringContaining('fullLoad-'));
            expect(measureSpy).toHaveBeenCalledTimes(2);

            markSpy.mockRestore();
            measureSpy.mockRestore();
        });

        test('calculates load time metrics after fullLoad mark', () => {
            monitor.mark('create');
            const startTime = performance.now();
            while (performance.now() - startTime < 10) {
            }
            monitor.mark('load');
            monitor.mark('fullLoad');

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.loadTimeMs).toBeGreaterThan(0);
            expect(metrics.fullLoadTimeMs).toBeGreaterThan(0);
            expect(metrics.fullLoadTimeMs).toBeGreaterThanOrEqual(metrics.loadTimeMs);
        });

        test('handles missing duration in performance entries', () => {
            monitor.mark('create');
            monitor.mark('load');

            const spy = vi.spyOn(performance, 'getEntriesByName').mockReturnValue([{} as PerformanceEntry]);

            monitor.mark('fullLoad');

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.loadTimeMs).toBe(0);
            expect(metrics.fullLoadTimeMs).toBe(0);

            spy.mockRestore();
        });
    });

    describe('recordStartOfFrameAt', () => {
        test('first frame does not record duration', () => {
            monitor.recordStartOfFrameAt(1000);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.lastFrameDurationMs).toBe(undefined);
            expect(metrics.totalFramesCount).toBe(0);
        });

        test('tracks frame time between consecutive frames', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1016.67); // ~60 FPS

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.totalFramesCount).toBe(1);
            expect(metrics.lastFrameDurationMs).toBeCloseTo(16.67);
        });

        test('calculates average frames per second', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1016.67);
            monitor.recordStartOfFrameAt(1033.33);
            monitor.recordStartOfFrameAt(1050);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.totalFramesCount).toBe(3);
            expect(metrics.averageFramesPerSecond).toBeCloseTo(60, 0);
        });

        test('detects dropped frames when frame time exceeds target', () => {
            expect(monitor.getPerformanceMetrics().droppedFramesCount).toBe(0);
            expect(monitor.getPerformanceMetrics().totalFramesCount).toBe(0);

            // the n is to account for floating point precision errors
            monitor.recordStartOfFrameAt(0 * 1000 / 60 - 0);

            expect(monitor.getPerformanceMetrics().droppedFramesCount).toBe(0);
            expect(monitor.getPerformanceMetrics().totalFramesCount).toBe(0);

            monitor.recordStartOfFrameAt(1 * 1000 / 60 - 1);

            expect(monitor.getPerformanceMetrics().droppedFramesCount).toBe(0);
            expect(monitor.getPerformanceMetrics().totalFramesCount).toBe(1);

            monitor.recordStartOfFrameAt(3 * 1000 / 60 - 2);

            expect(monitor.getPerformanceMetrics().droppedFramesCount).toBe(1);
            expect(monitor.getPerformanceMetrics().totalFramesCount).toBe(2);

            monitor.recordStartOfFrameAt(4 * 1000 / 60 - 3);

            expect(monitor.getPerformanceMetrics().droppedFramesCount).toBe(1);
            expect(monitor.getPerformanceMetrics().totalFramesCount).toBe(3);
        });

        test('does not count frames faster than 60 fps as dropped', () => {
            monitor.recordStartOfFrameAt(0 * 1000 / 120);
            monitor.recordStartOfFrameAt(1 * 1000 / 120);
            monitor.recordStartOfFrameAt(2 * 1000 / 120);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.droppedFramesCount).toBe(0);
            expect(metrics.totalFramesCount).toBe(2);
        });

        test('handles varying frame times', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1010);
            monitor.recordStartOfFrameAt(1030);
            monitor.recordStartOfFrameAt(1045);
            monitor.recordStartOfFrameAt(1095);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.totalFramesCount).toBe(4);
            expect(metrics.droppedFramesCount).toBe(2);
        });

        test('accumulates frame time correctly', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1020);
            monitor.recordStartOfFrameAt(1040);
            monitor.recordStartOfFrameAt(1060);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.averageFramesPerSecond).toBeCloseTo(50, 0);
        });
    });

    describe('resetRuntimeMetrics', () => {
        test('resets all frame metrics', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1016.67);
            monitor.recordStartOfFrameAt(1033.33);

            monitor.resetRuntimeMetrics();

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.lastFrameDurationMs).toBeUndefined();
            expect(metrics.totalFramesCount).toBe(0);
            expect(metrics.droppedFramesCount).toBe(0);
        });

        test('allows metrics to be recorded again after resetting', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1020);

            monitor.resetRuntimeMetrics();

            monitor.recordStartOfFrameAt(2000);
            monitor.recordStartOfFrameAt(2016.67);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.totalFramesCount).toBe(1);
            expect(metrics.lastFrameDurationMs).toBeCloseTo(16.67);
        });
    });

    describe('remove', () => {
        test('clears both runtime and initialization metrics', () => {
            const clearMarksSpy = vi.spyOn(performance, 'clearMarks');
            const clearMeasuresSpy = vi.spyOn(performance, 'clearMeasures');

            monitor.mark('create');
            monitor.mark('load');
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1020);

            monitor.remove();

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.lastFrameDurationMs).toBeUndefined();
            expect(metrics.totalFramesCount).toBe(0);
            expect(clearMarksSpy).toHaveBeenCalled();
            expect(clearMeasuresSpy).toHaveBeenCalled();

            clearMarksSpy.mockRestore();
            clearMeasuresSpy.mockRestore();
        });
    });

    describe('getPerformanceMetrics', () => {
        test('returns metrics object with all properties', () => {
            monitor.mark('create');
            monitor.mark('load');
            monitor.mark('fullLoad');
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1016.67);

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics).toHaveProperty('loadTimeMs');
            expect(metrics).toHaveProperty('fullLoadTimeMs');
            expect(metrics).toHaveProperty('lastFrameDurationMs');
            expect(metrics).toHaveProperty('averageFramesPerSecond');
            expect(metrics).toHaveProperty('droppedFramesCount');
            expect(metrics).toHaveProperty('totalFramesCount');
        });

        test('returns undefined load times when marks not set', () => {
            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.loadTimeMs).toBeUndefined();
            expect(metrics.fullLoadTimeMs).toBeUndefined();
        });

        test('returns NaN for averageFramesPerSecond with no frames', () => {
            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.averageFramesPerSecond).toBeNaN();
            expect(metrics.totalFramesCount).toBe(0);
            expect(metrics.droppedFramesCount).toBe(0);
        });

        test('calculates correct average FPS with multiple frames', () => {
            let currentTimestamp = 1000;
            monitor.recordStartOfFrameAt(currentTimestamp);
            for (let i = 0; i < 10; i++) {
                currentTimestamp += 16.67;
                monitor.recordStartOfFrameAt(currentTimestamp);
            }

            const metrics = monitor.getPerformanceMetrics();

            expect(metrics.totalFramesCount).toBe(10);
            expect(metrics.averageFramesPerSecond).toBeCloseTo(60, 0);
        });

        test('does not modify internal state when called', () => {
            monitor.recordStartOfFrameAt(1000);
            monitor.recordStartOfFrameAt(1016.67);

            const metrics1 = monitor.getPerformanceMetrics();
            const metrics2 = monitor.getPerformanceMetrics();

            expect(metrics1.totalFramesCount).toBe(metrics2.totalFramesCount);
            expect(metrics1.lastFrameDurationMs).toBe(metrics2.lastFrameDurationMs);
        });
    });

    describe('multiple instances', () => {
        test('maintains separate metrics for different instances', () => {
            const monitor1 = new PerformanceMonitor();
            const monitor2 = new PerformanceMonitor();

            monitor1.recordStartOfFrameAt(1000);
            monitor1.recordStartOfFrameAt(1016.67);

            monitor2.recordStartOfFrameAt(2000);
            monitor2.recordStartOfFrameAt(2033.33);

            const metrics1 = monitor1.getPerformanceMetrics();
            const metrics2 = monitor2.getPerformanceMetrics();

            expect(metrics1.lastFrameDurationMs).toBeCloseTo(16.67);
            expect(metrics2.lastFrameDurationMs).toBeCloseTo(33.33);
            expect(metrics1.totalFramesCount).toBe(1);
            expect(metrics2.totalFramesCount).toBe(1);
        });

        test('clearing one instance does not affect another', () => {
            const monitor1 = new PerformanceMonitor();
            const monitor2 = new PerformanceMonitor();

            monitor1.recordStartOfFrameAt(1000);
            monitor1.recordStartOfFrameAt(1020);

            monitor2.recordStartOfFrameAt(2000);
            monitor2.recordStartOfFrameAt(2020);

            monitor1.resetRuntimeMetrics();

            const metrics1 = monitor1.getPerformanceMetrics();
            const metrics2 = monitor2.getPerformanceMetrics();

            expect(metrics1.totalFramesCount).toBe(0);
            expect(metrics2.totalFramesCount).toBe(1);
        });
    });
});

describe('RequestPerformance', () => {
    let requestParams: RequestParameters;

    beforeEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
        requestParams = {
            url: 'http://example.com/test.json'
        } as RequestParameters;
    });

    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    describe('constructor', () => {
        test('creates start mark on instantiation', () => {
            const markSpy = vi.spyOn(performance, 'mark');

            new RequestPerformance(requestParams);

            expect(markSpy).toHaveBeenCalledWith('http://example.com/test.json#start');

            markSpy.mockRestore();
        });
    });

    describe('finish', () => {
        test('creates end mark when called', () => {
            const markSpy = vi.spyOn(performance, 'mark');
            const reqPerf = new RequestPerformance(requestParams);

            reqPerf.finish();

            expect(markSpy).toHaveBeenCalledWith('http://example.com/test.json#end');

            markSpy.mockRestore();
        });

        test('returns resource timing data', () => {
            const reqPerf = new RequestPerformance(requestParams);

            const timingData = reqPerf.finish();

            expect(Array.isArray(timingData)).toBe(true);
            expect(timingData.length).toBeGreaterThan(0);
            expect(timingData[0]).toHaveProperty('duration');
            expect(timingData[0]).toHaveProperty('startTime');
        });

        test('creates fallback measure when getEntriesByName returns empty', () => {
            const reqPerf = new RequestPerformance(requestParams);

            let callCount = 0;
            const spy = vi.spyOn(performance, 'getEntriesByName').mockImplementation((name: string) => {
                callCount++;
                if (callCount === 1) {
                    return [];
                } else {
                    return [{
                        name,
                        entryType: 'measure',
                        startTime: 0,
                        duration: 10
                    } as PerformanceEntry];
                }
            });

            const measureSpy = vi.spyOn(performance, 'measure');

            const timingData = reqPerf.finish();

            expect(measureSpy).toHaveBeenCalledWith(
                'http://example.com/test.json',
                'http://example.com/test.json#start',
                'http://example.com/test.json#end'
            );
            expect(Array.isArray(timingData)).toBe(true);
            expect(timingData.length).toBeGreaterThan(0);

            measureSpy.mockRestore();
            spy.mockRestore();
        });

        test('cleans up marks and measures when creating fallback measure', () => {
            const reqPerf = new RequestPerformance(requestParams);

            let callCount = 0;
            const spy = vi.spyOn(performance, 'getEntriesByName').mockImplementation((name: string) => {
                callCount++;
                if (callCount === 1) {
                    return [];
                } else {
                    return [{
                        name,
                        entryType: 'measure',
                        startTime: 0,
                        duration: 10
                    } as PerformanceEntry];
                }
            });

            const clearMarksSpy = vi.spyOn(performance, 'clearMarks');
            const clearMeasuresSpy = vi.spyOn(performance, 'clearMeasures');

            reqPerf.finish();

            expect(clearMarksSpy).toHaveBeenCalledWith('http://example.com/test.json#start');
            expect(clearMarksSpy).toHaveBeenCalledWith('http://example.com/test.json#end');
            expect(clearMeasuresSpy).toHaveBeenCalledWith('http://example.com/test.json');

            clearMarksSpy.mockRestore();
            clearMeasuresSpy.mockRestore();
            spy.mockRestore();
        });

        test('measures time between start and finish', () => {
            const reqPerf = new RequestPerformance(requestParams);

            const startTime = performance.now();
            while (performance.now() - startTime < 5) {
            }

            const timingData = reqPerf.finish();

            expect(timingData.length).toBeGreaterThan(0);
            expect(timingData[0].duration).toBeGreaterThan(0);
        });
    });
});
