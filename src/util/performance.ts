/**
 * Represents a collection of performance metrics for the map.
 */
export type PerformanceMetrics = {
    loadTime: number;
    fullLoadTime: number;
    fps: number;
    percentDroppedFrames: number;
    totalFrames: number;
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
    frame(timestamp: number) {
        const currTimestamp = timestamp;
        if (lastFrameTime != null) {
            const frameTime = currTimestamp - lastFrameTime;
            frameTimes.push(frameTime);
        }
        lastFrameTime = currTimestamp;
    },
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
    * Calculates and returns the current performance metrics for this monitor instance.
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
