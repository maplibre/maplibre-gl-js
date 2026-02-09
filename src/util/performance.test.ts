import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {RequestPerformance} from './performance';

describe('RequestPerformance', () => {
    const url = 'http://example.com/test.json';

    beforeEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    describe('finish', () => {
        test('returns resource timing data with expected structure', () => {
            const reqPerf = new RequestPerformance(url);
            const timingData = reqPerf.finish();

            expect(Array.isArray(timingData)).toBe(true);
            expect(timingData.length).toBeGreaterThan(0);
            expect(timingData[0]).toHaveProperty('duration');
            expect(timingData[0]).toHaveProperty('startTime');
        });

        test('creates fallback measure when resource timing unavailable', () => {
            const reqPerf = new RequestPerformance(url);

            let callCount = 0;
            const spy = vi.spyOn(performance, 'getEntriesByName').mockImplementation((name: string) => {
                callCount++;
                if (callCount === 1) {
                    // Simulate web worker scenario where resource timing is empty
                    return [];
                } else {
                    // Return the fallback measure
                    return [{
                        name,
                        entryType: 'measure',
                        startTime: 0,
                        duration: 10
                    } as PerformanceEntry];
                }
            });

            const timingData = reqPerf.finish();

            expect(Array.isArray(timingData)).toBe(true);
            expect(timingData.length).toBeGreaterThan(0);
            expect(timingData[0]).toHaveProperty('duration');
            expect(timingData[0]).toHaveProperty('startTime');

            spy.mockRestore();
        });
    });
});
