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
    /** The total number of "ideal frames" that could have fit into the time lost by slow frames */
    virtualDroppedFramesCount: number;
    /** Total number of frames rendered. */
    totalFramesCount: number;
};

export enum PerformanceMarkers {
    create = 'create',
    load = 'load',
    fullLoad = 'fullLoad'
}

let lastFrameTime = null;
let frameTimes = [];

const minFramerateTarget = 60;
const frameTimeTarget = 1000 / minFramerateTarget;

const loadTimeKey = 'loadTime';
const fullLoadTimeKey = 'fullLoadTime';

/**
 * Monitors and reports map performance metrics
 */
export const PerformanceUtils = {
    /**
    * Marks point in time of the map lifecycle.
    */
    mark(marker: PerformanceMarkers) {
        performance.mark(marker);
    },
    /**
    * Records the time of a new animation frame.
    * Used internally for FPS calculation.
    * @param currentTimestamp - The current timestamp provided by requestAnimationFrame.
    */
    recordStartOfFrameAt(currentTimestamp: number) {
        if (lastFrameTime != null) {
            const frameTime = currentTimestamp - lastFrameTime;
            frameTimes.push(frameTime);
        }
        lastFrameTime = currentTimestamp;
    },

    resetRuntimeMetrics() {
        lastFrameTime = null;
        frameTimes = [];
    },

    /**
    * @internal
    * Clear browser performance entries associated with this monitor
    */
    clearInitializationMetrics() {
        performance.clearMeasures(loadTimeKey);
        performance.clearMeasures(fullLoadTimeKey);

        for (const marker in PerformanceMarkers) {
            performance.clearMarks(PerformanceMarkers[marker]);
        }
    },

    /**
     * Clears both the runtime and initialisation metrics
     */
    remove() {
        this.resetRuntimeMetrics();
        this.clearInitializationMetrics();
    },

    /**
    * Calculates and returns the current performance metrics for this monitor instance.
    * @returns An object containing various performance metrics.
    */
    getPerformanceMetrics(): PerformanceMetrics {
        performance.measure(loadTimeKey, PerformanceMarkers.create, PerformanceMarkers.load);
        performance.measure(fullLoadTimeKey, PerformanceMarkers.create, PerformanceMarkers.fullLoad);
        const loadTimeMs = performance.getEntriesByName(loadTimeKey)[0].duration;
        const fullLoadTimeMs = performance.getEntriesByName(fullLoadTimeKey)[0].duration;
        const totalFramesCount = frameTimes.length;

        const avgFrameTime = frameTimes.reduce((prev, curr) => prev + curr, 0) / totalFramesCount / 1000;
        const averageFramesPerSecond = 1 / avgFrameTime;

        // count frames that missed our framerate target
        const virtualDroppedFramesCount = frameTimes
            .filter((frameTime) => frameTime > frameTimeTarget)
            .reduce((acc, curr) => {
                return acc + (curr -  frameTimeTarget) / frameTimeTarget;
            }, 0);

        return {
            loadTimeMs,
            fullLoadTimeMs,
            averageFramesPerSecond,
            virtualDroppedFramesCount,
            totalFramesCount
        };
    }
};

/**
 * @internal
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 */
export class RequestPerformance {
    private start: string;
    private end: string;
    private measure: string;

    constructor (url: string) {
        this.start = `${url}#start`;
        this.end = `${url}#end`;
        this.measure = url;

        performance.mark(this.start);
    }

    finish() {
        performance.mark(this.end);
        let resourceTimingData = performance.getEntriesByName(this.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            performance.measure(this.measure, this.start, this.end);
            resourceTimingData = performance.getEntriesByName(this.measure);

            // cleanup
            performance.clearMarks(this.start);
            performance.clearMarks(this.end);
            performance.clearMeasures(this.measure);
        }

        return resourceTimingData;
    }
}
