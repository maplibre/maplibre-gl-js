import type {RequestParameters} from '../util/ajax';

/**
 * Represents a collection of performance metrics for the map.
 */
export type PerformanceMetrics = {
    /** Time taken to load the initial map view, measured from the map's creation until its initial style and sources are loaded. */
    loadTimeMs: number;
    /** Time taken for the map to fully load all its resources, measured from the map's creation until all tiles, sprites, and other assets are loaded. */
    fullLoadTimeMs: number;
    /** Average frames per second. */
    averageFramesPerSecond: number;
    /** Number of frames that fell below 60 fps. */
    droppedFramesCount: number;
    /** Total number of frames recorded. */
    totalFramesCount: number;
};

/**
 * Defines key performance markers for tracking various stages of map loading and rendering.
 * These markers are used with the Performance API to measure durations.
 */
export enum PerformanceMarkers {
    /** Marks the instantiation of the Map object. */
    create = 'create',
    /** Marks when the map's initial style and all its necessary sources have been loaded. This does not necessarily mean all tiles are loaded. */
    load = 'load',
    /** Marks when all resources (tiles, sprites, icons, etc.) required for the current view have been fully loaded and rendered. */
    fullLoad = 'fullLoad'
}

const minFramerateTarget = 60;
const frameTimeTarget = 1000 / minFramerateTarget;

const loadTimeKey = 'loadTime';
const fullLoadTimeKey = 'fullLoadTime';

/**
 * Monitors and reports map performance metrics
 */
export class PerformanceMonitor {
    private static _nextId = 0; // Static counter for unique IDs
    _lastFrameTime: number | null = null;
    _totalFrameTime = 0;
    _totalFrameCount = 0;
    _totalDroppedFrameCount = 0;

    // Unique markers for this instance to avoid global collision
    _createMarker: string;
    _loadMarker: string;
    _fullLoadMarker: string;
    _loadTimeMeasure: string;
    _fullLoadTimeMeasure: string;

    constructor() {
        const _id = PerformanceMonitor._nextId++;
        this._createMarker = `${PerformanceMarkers.create}-${_id}`;
        this._loadMarker = `${PerformanceMarkers.load}-${_id}`;
        this._fullLoadMarker = `${PerformanceMarkers.fullLoad}-${_id}`;
        this._loadTimeMeasure = `${loadTimeKey}-${_id}`;
        this._fullLoadTimeMeasure = `${fullLoadTimeKey}-${_id}`;

        // Clear any lingering global performance marks related to these keys to avoid interference.
        performance.clearMarks(this._createMarker);
        performance.clearMarks(this._loadMarker);
        performance.clearMarks(this._fullLoadMarker);
        performance.clearMeasures(this._fullLoadTimeMeasure);
        performance.clearMeasures(this._loadTimeMeasure);
    }

    /**
     * Records a performance marker at the current time.
     * @param marker - The specific performance marker to record.
     */
    mark(marker: PerformanceMarkers) {
        switch (marker) {
            case PerformanceMarkers.create:
                performance.mark(this._createMarker);
                break;
            case PerformanceMarkers.load:
                performance.mark(this._loadMarker);
                break;
            case PerformanceMarkers.fullLoad:
                performance.mark(this._fullLoadMarker);
                break;
        }
    }

    /**
     * Records the time of a new animation frame. Used internally for FPS calculation.
     * @param timestamp - The current timestamp provided by requestAnimationFrame.
     */
    frame(timestamp: number) {
        const currTimestamp = timestamp;
        if (this._lastFrameTime != null) {
            const frameTime = currTimestamp - this._lastFrameTime;

            // Add new frame time to circular buffer
            this._totalFrameTime += frameTime;

            // Track lifetime metrics
            this._totalFrameCount++;
            if (frameTime > frameTimeTarget) {
                this._totalDroppedFrameCount++;
            }
        }
        this._lastFrameTime = currTimestamp;
    }

    /**
     * Clears all recorded performance metrics and markers for this monitor instance.
     */
    clearMetrics() {
        this._lastFrameTime = null;
        this._totalFrameTime = 0;
        this._totalFrameCount = 0;
        this._totalDroppedFrameCount = 0;
        // Clear browser performance entries associated with this monitor
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
    getPerformanceMetrics(): PerformanceMetrics {
        // Ensure measures are taken before querying
        performance.measure(this._loadTimeMeasure, this._createMarker, this._loadMarker);
        performance.measure(this._fullLoadTimeMeasure, this._createMarker, this._fullLoadMarker);

        const loadTimeMs = performance.getEntriesByName(this._loadTimeMeasure)[0]?.duration || 0;
        const fullLoadTimeMs = performance.getEntriesByName(this._fullLoadTimeMeasure)[0]?.duration || 0;

        const avgFrameTimeMs = this._totalFrameTime / this._totalFrameCount;
        const averageFramesPerSecond = 1000 / avgFrameTimeMs; // Convert ms to FPS

        return {
            loadTimeMs,
            fullLoadTimeMs,
            averageFramesPerSecond,
            droppedFramesCount: this._totalDroppedFrameCount,
            totalFramesCount: this._totalFrameCount
        };
    }
}

/**
 * @internal
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 */
export class RequestPerformance {
    _marks: {
        start: string;
        end: string;
        measure: string;
    };

    constructor (request: RequestParameters) {
        this._marks = {
            start: [request.url, 'start'].join('#'),
            end: [request.url, 'end'].join('#'),
            measure: request.url.toString()
        };

        performance.mark(this._marks.start);
    }

    finish() {
        performance.mark(this._marks.end);
        let resourceTimingData = performance.getEntriesByName(this._marks.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            performance.measure(this._marks.measure, this._marks.start, this._marks.end);
            resourceTimingData = performance.getEntriesByName(this._marks.measure);

            // cleanup
            performance.clearMarks(this._marks.start);
            performance.clearMarks(this._marks.end);
            performance.clearMeasures(this._marks.measure);
        }

        return resourceTimingData;
    }
}

export default performance;
