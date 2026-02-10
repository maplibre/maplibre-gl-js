import {type PerformanceEventType, type IPerformanceObserver} from './observer';

const minFramerateTarget = 60;
const frameTimeTarget = 1000 / minFramerateTarget;

/**
 * Represents a collection of performance metrics for the map.
 */
export type RenderingPerformanceMetrics = {
    /** Time taken for the last frame to render, measured from the last frame's frame-rendering start until the next frames rendering starts. */
    lastFrameDurationMs?: number;
    /** Average frames per second. */
    averageFramesPerSecond: number;
    /** Number of frames that fell below 60 fps. */
    droppedFramesCount: number;
    /** Total number of frames recorded. */
    totalFramesCount: number;
};

/**
 * Monitors and reports map performance metrics using the Observer pattern
 * @group Performance
 */
export class RenderingPerformanceObserver implements IPerformanceObserver {
    private _lastFrameTime?: number;
    private _lastFrameDuration: number;
    private _totalFrameTime = 0;
    private _totalFrameCount = 0;
    private _totalDroppedFrameCount = 0;


    /** {@inheritdoc IPerformanceObserver.observe} */
    observe(type: PerformanceEventType, timestamp: number): void {
        if (type ===  'startOfFrame') {
            if (this._lastFrameTime !== undefined) {
                this._totalFrameCount++;

                const frameDuration = timestamp - this._lastFrameTime;
                this._totalFrameTime += frameDuration;
                this._lastFrameDuration = frameDuration;
                if (frameDuration > frameTimeTarget) {
                    this._totalDroppedFrameCount++;
                }
            }
            this._lastFrameTime = timestamp;
        }
    }

    /**
     * Resets all recorded performance metrics
     */
    reset(): void {
        this._lastFrameTime = undefined;
        this._lastFrameDuration = undefined;
        this._totalFrameTime = 0;
        this._totalFrameCount = 0;
        this._totalDroppedFrameCount = 0;
    }

    /** {@inheritdoc IPerformanceObserver.disconnect} */
    disconnect(): void {
        this.reset();
    }

    /**
     * Calculates and returns the current performance metrics for this monitor instance.
     * @returns An object containing various performance metrics.
     */
    takeRecords(): RenderingPerformanceMetrics {
        const avgFrameTimeMs = this._totalFrameTime / this._totalFrameCount;
        const averageFramesPerSecond = 1000 / avgFrameTimeMs; // Convert ms to FPS

        return {
            lastFrameDurationMs: this._lastFrameDuration,
            averageFramesPerSecond,
            droppedFramesCount: this._totalDroppedFrameCount,
            totalFramesCount: this._totalFrameCount
        };
    }
}
