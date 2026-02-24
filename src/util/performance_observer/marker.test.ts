import {describe, test, expect, beforeEach, afterEach} from 'vitest';
import {MarkingPerformanceObserver} from './marker';

describe('MarkingPerformanceObserver', () => {
    beforeEach(() => {
        performance.clearMarks();
    });

    afterEach(() => {
        performance.clearMarks();
    });

    test('marks performance events', () => {
        const observer = new MarkingPerformanceObserver();

        observer.observe('create', 100);
        observer.observe('load', 250);

        const marks = performance.getEntriesByType('mark');
        const markNames = marks.map(mark => mark.name);

        expect(markNames).toContain('create');
        expect(markNames).toContain('load');

        observer.disconnect();
    });

    test('disconnect clears marks', () => {
        const observer = new MarkingPerformanceObserver();

        observer.observe('create', 100);
        observer.observe('load', 250);

        observer.disconnect();

        const marks = performance.getEntriesByType('mark');
        const markNames = marks.map(mark => mark.name);

        expect(markNames).not.toContain('create');
        expect(markNames).not.toContain('load');
    });
});
