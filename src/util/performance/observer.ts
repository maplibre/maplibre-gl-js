/**
 * Performance event types that can be observed
 */
export type PerformanceEventType = 'create' | 'load' | 'fullLoad' | 'frame';

/**
 * Observer interface for performance monitoring
 */
export interface PerformanceObserver {
    /**
     * Called when a performance event occurs
     * @param timestamp - when the event occurred
     * @param type - the type of event
     */
    observe(type: PerformanceEventType, timestamp: number): void;
    /**
     * Removes the observer
     */
    disconnect(): void;
}

/**
 * Subject that notifies observers of performance events
 */
export class PerformanceSubject {
    private readonly _observers: ReadonlyArray<PerformanceObserver>;

    /**
     * Creates a new PerformanceSubject with a static list of observers
     * @param observers - Array of observers to be notified of performance events
     */
    constructor(observers: PerformanceObserver[]) {
        this._observers = Object.freeze(observers);
    }

    /**
     * Notifies all observers of a performance event
     * @param event - The performance event data
     */
    notifyObservers(type: PerformanceEventType, timestamp: number): void {
        this._observers.forEach(observer => observer.observe(type, timestamp));
    }

    remove(): void {
        this._observers.forEach(observer => observer.disconnect());
    }
}
