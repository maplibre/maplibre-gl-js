import {type PerformanceEventType, type IPerformanceObserver} from './observer';

/**
 * Marks points in time when certain events occur
 * 
 * This is useful because they are visible in the performance timeline
 * @group Performance
 */
export class MarkingPerformanceObserver implements IPerformanceObserver {
    private _markedEvents: Set<string> = new Set();
    private _suffix: string;

    constructor(suffix?: string) {
        this._suffix = suffix ? `-${suffix}` : '';
    }

    /** {@inheritDoc} */
    observe(type: PerformanceEventType, _timestamp: number): void {
        const key = `${type}${this._suffix}`;
        performance.mark(key);
        this._markedEvents.add(key);
    }

    /** {@inheritDoc} */
    disconnect(): void {
        for (const key of this._markedEvents) {
            performance.clearMarks(key);
        }
        this._markedEvents.clear();
    }
}
