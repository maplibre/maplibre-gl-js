import type {RequestParameters} from '../util/ajax';

/**
 * Represents a collection of performance metrics for the map.
 */
export type PerformanceMetrics = {
    /** Time taken to load the initial map view, measured from the map's creation until its initial style and sources are loaded. */
    loadTimeMs?: number;
    /** Time taken for the map to fully load all its resources, measured from the map's creation until all tiles, sprites, and other assets are loaded. */
    fullLoadTimeMs?: number;
    /** Time taken for the last frame to render, measured from the last frame's frame-rendering start until the next frames rendering starts. */
    lastFrameTimeMs?: number;
    /** Average frames per second. */
    averageFramesPerSecond: number;
    /** Number of frames that fell below 60 fps. */
    droppedFramesCount: number;
    /** Total number of frames recorded. */
    totalFramesCount: number;
};

const minFramerateTarget = 60;
const frameTimeTarget = 1000 / minFramerateTarget;

type PerformanceMarker = 'create' | 'load' | 'fullLoad';

/**
 * Monitors and reports map performance metrics
 */
export class PerformanceMonitor {
    private static _nextId = 0; // Static counter for unique IDs
    private _id: number;
    private _lastFrameTime?: number;
    private _totalFrameTime = 0;
    private _totalFrameCount = 0;
    private _totalDroppedFrameCount = 0;

    // Unique markers for this instance to avoid global collision
    private _createMarker: string;
    private _loadMarker: string;
    private _fullLoadMarker: string;
    private _loadTimeMeasure: string;
    private _fullLoadTimeMeasure: string;
    private _loadTimeMs: number;
    private _fullLoadTimeMs: number;

    constructor() {
        this._id = PerformanceMonitor._nextId++;
        this._createMarker = `create-${this._id}`;
        this._loadMarker = `load-${this._id}`;
        this._fullLoadMarker = `fullLoad-${this._id}`;
        this._loadTimeMeasure = `load-${this._id}`;
        this._fullLoadTimeMeasure = `fullLoad-${this._id}`;

        // Clear any lingering global performance marks related to these keys to avoid interference.
        performance.clearMarks(this._createMarker);
        performance.clearMarks(this._loadMarker);
        performance.clearMarks(this._fullLoadMarker);
        performance.clearMeasures(this._fullLoadTimeMeasure);
        performance.clearMeasures(this._loadTimeMeasure);
    }

    /**
     * Records when the map was created
     */
    mark(marker: PerformanceMarker) {
        performance.mark(`${marker}-${this._id}`);
        if (marker === 'fullLoad') {
            // Ensure measures are taken before querying
            performance.measure(this._loadTimeMeasure, this._createMarker, this._loadMarker);
            performance.measure(this._fullLoadTimeMeasure, this._createMarker, this._fullLoadMarker);
    
            this._loadTimeMs = performance.getEntriesByName(this._loadTimeMeasure)[0]?.duration || 0;
            this._fullLoadTimeMs = performance.getEntriesByName(this._fullLoadTimeMeasure)[0]?.duration || 0;
        }
    }

    /**
     * Records the time of a new animation frame. Used internally for FPS calculation.
     * @param currentTimestamp - The current timestamp provided by requestAnimationFrame.
     */
    frame(currentTimestamp: number) {
        if (this._lastFrameTime !== undefined) {
            const frameTime = currentTimestamp - this._lastFrameTime;
            this._totalFrameTime += frameTime;

            // Track lifetime metrics
            this._totalFrameCount++;
            if (frameTime > frameTimeTarget) {
                this._totalDroppedFrameCount++;
            }
        }
        this._lastFrameTime = currentTimestamp;
    }

    /**
     * Clears all recorded performance metrics and markers for this monitor instance.
     */
    clearMetrics() {
        this._lastFrameTime = undefined;
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
        const avgFrameTimeMs = this._totalFrameTime / this._totalFrameCount;
        const averageFramesPerSecond = 1000 / avgFrameTimeMs; // Convert ms to FPS

        return {
            loadTimeMs: this._loadTimeMs,
            fullLoadTimeMs: this._fullLoadTimeMs,
            lastFrameTimeMs: this._lastFrameTime,
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
