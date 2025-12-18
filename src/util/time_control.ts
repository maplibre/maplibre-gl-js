/**
 * Manages time flow with optional freezing capability for deterministic rendering.
 */
class TimeManager {
    private _realTime = typeof performance !== 'undefined' && performance && performance.now ?
        performance.now.bind(performance) :
        Date.now.bind(Date);

    private _frozenAt: number | null = null;

    /**
     * Gets the current time, either real or frozen.
     * @returns Current time in milliseconds
     */
    getCurrentTime(): number {
        return this._frozenAt !== null ? this._frozenAt : this._realTime();
    }

    /**
     * Sets time at a specific timestamp.
     * @param timestamp - Time in milliseconds to set
     */
    setNow(timestamp: number): void {
        this._frozenAt = timestamp;
    }

    /**
     * Restores normal time flow.
     */
    restoreNow(): void {
        this._frozenAt = null;
    }

    /**
     * Returns whether time is currently frozen.
     * @returns True if time is frozen, false otherwise
     */
    isFrozen(): boolean {
        return this._frozenAt !== null;
    }
}

const timeManager = new TimeManager();

/**
 * Returns the current time in milliseconds.
 * When time is frozen via setNow(), returns the frozen timestamp.
 * Otherwise returns real browser time (performance.now() or Date.now()).
 *
 * @returns Current time in milliseconds
 * @example
 * ```ts
 * // Measure elapsed time
 * const start = maplibregl.now();
 * // ... later ...
 * const elapsed = maplibregl.now() - start;
 *
 * // During frozen time
 * maplibregl.setNow(16.67);
 * console.log(maplibregl.now()); // 16.67
 * maplibregl.restoreNow();
 * console.log(maplibregl.now()); // real time
 * ```
 */
export function now(): number {
    return timeManager.getCurrentTime();
}

/**
 * Freezes time at a specific timestamp for deterministic rendering.
 * Useful for frame-by-frame video capture where each frame needs
 * a consistent time value.
 *
 * @param timestamp - Time in milliseconds to freeze at
 * @example
 * ```ts
 * // Freeze time for video export at 60fps
 * setNow(0);           // First frame
 * // ... render frame ...
 * setNow(16.67);       // Second frame
 * // ... render frame ...
 * setNow(33.34);       // Third frame
 * // ... done ...
 * restoreNow();        // Resume normal time
 * ```
 */
export function setNow(timestamp: number): void {
    timeManager.setNow(timestamp);
}

/**
 * Restores normal time flow after freezing with setNow().
 * Call this after finishing deterministic rendering operations.
 *
 * @example
 * ```ts
 * // After video export, resume normal time
 * setNow(0);
 * // ... export frames ...
 * restoreNow(); // Map animations resume normally
 * ```
 */
export function restoreNow(): void {
    timeManager.restoreNow();
}

/**
 * Returns whether time is currently frozen.
 * @returns True if time is frozen via setNow(), false otherwise
 * @example
 * ```ts
 * setNow(1000);
 * console.log(isTimeFrozen()); // true
 * restoreNow();
 * console.log(isTimeFrozen()); // false
 * ```
 */
export function isTimeFrozen(): boolean {
    return timeManager.isFrozen();
}