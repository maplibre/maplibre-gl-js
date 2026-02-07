import type {RequestParameters} from '../util/ajax';

/**
 * Represents a collection of performance metrics for the map.
 */
export type PerformanceMetrics = {
    /** Time taken to load the initial map view, measured from the map's creation until its initial style and sources are loaded. */
    loadTime: number;
    /** Time taken for the map to fully load all its resources, measured from the map's creation until all tiles, sprites, and other assets are loaded. */
    fullLoadTime: number;
    /** Frames per second. */
    fps: number;
    /** Percentage of frames that fell below the target framerate. */
    percentDroppedFrames: number;
    /** Total number of frames recorded. */
    totalFrames: number;
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

let lastFrameTime = null;
let frameTimes = [];

const minFramerateTarget = 60;
const frameTimeTarget = 1000 / minFramerateTarget;

const loadTimeKey = 'loadTime';
const fullLoadTimeKey = 'fullLoadTime';

/**
 * @internal
 * Provides utility methods for measuring and reporting map performance metrics.
 */
export const PerformanceUtils = {
    /**
     * @internal
     * Records a performance marker at the current time.
     * @param marker - The specific performance marker to record.
     */
    mark(marker: PerformanceMarkers) {
        performance.mark(marker);
    },
    /**
     * @internal
     * Records the time of a new animation frame. Used internally for FPS calculation.
     * @param timestamp - The current timestamp provided by requestAnimationFrame.
     */
    frame(timestamp: number) {
        const currTimestamp = timestamp;
        if (lastFrameTime != null) {
            const frameTime = currTimestamp - lastFrameTime;
            frameTimes.push(frameTime);
        }
        lastFrameTime = currTimestamp;
    },
    /**
     * @internal
     * Clears all recorded performance metrics and markers.
     */
    clearMetrics() {
        lastFrameTime = null;
        frameTimes = [];
        performance.clearMeasures(loadTimeKey);
        performance.clearMeasures(fullLoadTimeKey);

        for (const marker in PerformanceMarkers) {
            performance.clearMarks(PerformanceMarkers[marker]);
        }
    },

    /**
     * Calculates and returns the current performance metrics.
     * @returns An object containing various performance metrics.
     */
    getPerformanceMetrics(): PerformanceMetrics {
        performance.measure(loadTimeKey, PerformanceMarkers.create, PerformanceMarkers.load);
        performance.measure(fullLoadTimeKey, PerformanceMarkers.create, PerformanceMarkers.fullLoad);
        const loadTime = performance.getEntriesByName(loadTimeKey)[0].duration;
        const fullLoadTime = performance.getEntriesByName(fullLoadTimeKey)[0].duration;
        const totalFrames = frameTimes.length;

        const avgFrameTime = frameTimes.reduce((prev, curr) => prev + curr, 0) / totalFrames / 1000;
        const fps = 1 / avgFrameTime;

        // count frames that missed our framerate target
        const droppedFrames = frameTimes
            .filter((frameTime) => frameTime > frameTimeTarget)
            .reduce((acc, curr) => {
                return acc + (curr -  frameTimeTarget) / frameTimeTarget;
            }, 0);
        const percentDroppedFrames = (droppedFrames / (totalFrames + droppedFrames)) * 100;

        return {
            loadTime,
            fullLoadTime,
            fps,
            percentDroppedFrames,
            totalFrames
        };
    }
};

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
