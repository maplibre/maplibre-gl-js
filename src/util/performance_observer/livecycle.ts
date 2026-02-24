import {type PerformanceEventType, type IPerformanceObserver} from './observer';

/**
 * Represents a collection of performance metrics for the map.
 */
export type LivecyclePerformanceMetrics = {
    /** Time taken to load the initial map view, measured from the map's creation until its initial style and sources are loaded. */
    loadTimeMs?: number;
    /** Time taken for the map to fully load all its resources, measured from the map's creation until all tiles, sprites, and other assets are loaded. */
    fullLoadTimeMs?: number;
};

/**
 * Monitors and reports map performance metrics using the Observer pattern
 * @group Performance
 */
export class LivecyclePerformanceObserver implements IPerformanceObserver {
    private _createTimeAt?: number;
    private _loadTimeAt?: number;
    private _fullLoadTimeAt?: number;

    /** {@inheritDoc} */
    observe(type: PerformanceEventType, timestamp: number): void {
        switch (type) {
            case 'create':
                this._createTimeAt = timestamp;
                break;
            case 'load':
                this._loadTimeAt = timestamp;
                break;
            case 'fullLoad':
                this._fullLoadTimeAt = timestamp;
                break;
        }
    }

    /** {@inheritDoc} */
    disconnect(): void {
        this._createTimeAt = undefined;
        this._loadTimeAt = undefined;
        this._fullLoadTimeAt = undefined;
    }

    /**
     * Calculates and returns the current performance metrics for this monitor instance.
     * @returns An object containing various performance metrics.
     */
    takeRecords(): LivecyclePerformanceMetrics {
        return {
            loadTimeMs: this._loadTimeAt ? this._loadTimeAt - this._createTimeAt : undefined,
            fullLoadTimeMs: this._fullLoadTimeAt ? this._fullLoadTimeAt - this._createTimeAt : undefined,
        };
    }
}
