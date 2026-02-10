/**
 * Performance event types that can be observed
 */
export type PerformanceEventType = 'create' | 'load' | 'fullLoad' | 'startOfFrame';

/**
 * Observer interface for performance monitoring
 * @group Performance
 */
export interface IPerformanceObserver {
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
 * @internal
 */
export class PerformanceSubject {
    private readonly _observers: ReadonlyArray<IPerformanceObserver>;

    /**
     * Creates a new PerformanceSubject with a static list of observers
     * @param observers - Array of observers to be notified of performance events
     */
    constructor(observers: IPerformanceObserver[]) {
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
