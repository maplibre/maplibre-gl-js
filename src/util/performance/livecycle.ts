import {type PerformanceEventType, type PerformanceObserver} from './observer';

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
 */
export class LivecyclePerformanceMonitor implements PerformanceObserver {
    private static _nextId = 0;
    private _id: number;

    // Unique markers for this instance to avoid global collision
    private _createMarker: string;
    private _loadMarker: string;
    private _fullLoadMarker: string;
    private _loadTimeMeasure: string;
    private _fullLoadTimeMeasure: string;
    private _loadTimeMs: number;
    private _fullLoadTimeMs: number;

    constructor() {
        this._id = LivecyclePerformanceMonitor._nextId++;
        this._createMarker = `create-${this._id}`;
        this._loadMarker = `load-${this._id}`;
        this._fullLoadMarker = `fullLoad-${this._id}`;
        this._loadTimeMeasure = `load-${this._id}`;
        this._fullLoadTimeMeasure = `fullLoad-${this._id}`;
    }

    /**
     * Handles performance events from the subject
     * @param event - The performance event data
     */
    observe(type: PerformanceEventType, _timestamp: number): void {
        switch (type) {
            case 'create':
                performance.mark(this._createMarker);
                break;
            case 'load':
                performance.mark(this._loadMarker);
                break;
            case 'fullLoad':
                this._handleFullLoad();
                break;
        }
    }

    /**
     * Handles the 'fullLoad' event
     */
    private _handleFullLoad(): void {
        performance.mark(this._fullLoadMarker);

        // Ensure measures are taken before querying
        performance.measure(this._loadTimeMeasure, this._createMarker, this._loadMarker);
        performance.measure(this._fullLoadTimeMeasure, this._createMarker, this._fullLoadMarker);

        this._loadTimeMs = performance.getEntriesByName(this._loadTimeMeasure)[0]?.duration || 0;
        this._fullLoadTimeMs = performance.getEntriesByName(this._fullLoadTimeMeasure)[0]?.duration || 0;
    }

    /**
     * Clear browser performance entries associated with this monitor
     */
    private clearInitialisationMetrics(): void {
    }

    /**
     * Clears the initialisation metrics
     */
    disconnect(): void {
        performance.clearMarks(this._createMarker);
        performance.clearMarks(this._loadMarker);
        performance.clearMarks(this._fullLoadMarker);
        performance.clearMeasures(this._fullLoadTimeMeasure);
        performance.clearMeasures(this._loadTimeMeasure);
    }

    /**
     * Calculates and returns the current performance metrics for this monitor instance.
     * @returns An object containing various performance metrics.
     */
    takeRecords(): LivecyclePerformanceMetrics {
        return {
            loadTimeMs: this._loadTimeMs,
            fullLoadTimeMs: this._fullLoadTimeMs,
        };
    }
}
