import {extend, type Subscription} from './util.ts';

/**
 * A listener method used as a callback to events
 */
export type Listener<E extends Event = Event> = (event: E) => any;

/**
 * A mapping between event names and the event each of them carries.
 */
export type EventTypeMap = Record<string, Event>;

/**
 * The event names of an {@link EventTypeMap}.
 */
export type EventNames<EventType extends EventTypeMap> = Extract<keyof EventType, string>;

/**
 * Properties merged into every event bubbled up to an evented parent.
 */
export type EventedParentData = Record<string, unknown>;

type Listeners<EventType extends EventTypeMap> = {[K in keyof EventType]?: Array<Listener<EventType[K]>>};

function _addEventListener<T extends EventTypeMap, K extends EventNames<T>>(type: K, listener: Listener<T[K]>, listenerList: Listeners<T>) {
    const listenerExists = listenerList[type]?.includes(listener);
    if (!listenerExists) {
        listenerList[type] ||= [];
        listenerList[type].push(listener);
    }
}

function _removeEventListener<T extends EventTypeMap, K extends EventNames<T>>(type: K, listener: Listener<T[K]>, listenerList: Listeners<T>) {
    if (listenerList?.[type]) {
        const index = listenerList[type].indexOf(listener);
        if (index !== -1) {
            listenerList[type].splice(index, 1);
        }
    }
}

/**
 * The event class
 */
export class Event<TType extends string = string> {
    readonly type: TType;
    /**
     * The object that fired the event. Set when the event is fired, and narrowed to a more
     * specific type (e.g. `Map`, `Marker`) by the event subclasses.
     */
    target?: unknown;

    constructor(type: TType, data: object = {}) {
        extend(this, data);
        this.type = type;
    }
}

type ErrorLike = {
    message: string;
};

/**
 * An error event
 */
export class ErrorEvent extends Event<'error'> {
    error: ErrorLike;

    constructor(error: ErrorLike, data: object = {}) {
        super('error', extend({error}, data));
    }
}

/**
 * The event map of an {@link Evented} that only reports errors.
 */
export type ErrorEventType = {
    error: ErrorEvent;
};

/**
 * Methods mixed in to other classes for event capabilities.
 *
 * @group Event Related
 */
export abstract class Evented<EventType extends EventTypeMap = EventTypeMap> {
    _listeners?: Listeners<EventType>;
    _oneTimeListeners?: Listeners<EventType>;
    _eventedParent?: Evented;
    _eventedParentData?: EventedParentData | (() => EventedParentData);

    /**
     * Adds a listener to a specified event type.
     *
     * @param type - The event type to add a listen for.
     * @param listener - The function to be called when the event is fired.
     * The listener function is called with the data object passed to `fire`,
     * extended with `target` and `type` properties.
     */
    on<T extends EventNames<EventType>>(type: T, listener: (event: EventType[T]) => void): Subscription {
        this._listeners ||= {};
        _addEventListener(type, listener, this._listeners);

        return {
            unsubscribe: () => {
                this.off(type, listener);
            }
        };
    }

    /**
     * Removes a previously registered event listener.
     *
     * @param type - The event type to remove listeners for.
     * @param listener - The listener function to remove.
     */
    off<T extends EventNames<EventType>>(type: T, listener: (event: EventType[T]) => void): this {
        _removeEventListener(type, listener, this._listeners);
        _removeEventListener(type, listener, this._oneTimeListeners);

        return this;
    }

    /**
     * Adds a listener that will be called only once to a specified event type.
     *
     * The listener will be called first time the event fires after the listener is registered.
     *
     * @param type - The event type to listen for.
     * @returns a promise that resolves with the event
     */
    once<T extends EventNames<EventType>>(type: T): Promise<EventType[T]>;
    /**
     * Adds a listener that will be called only once to a specified event type.
     *
     * The listener will be called first time the event fires after the listener is registered.
     *
     * @param type - The event type to listen for.
     * @param listener - The function to be called when the event is fired the first time.
     * @returns `this` when a listener is provided
     */
    once<T extends EventNames<EventType>>(type: T, listener: (event: EventType[T]) => void): this;
    once<T extends EventNames<EventType>>(type: T, listener?: (event: EventType[T]) => void): this | Promise<EventType[T]> {
        if (!listener) {
            return new Promise((resolve) => this.once(type, resolve));
        }
        this._oneTimeListeners ||= {};
        _addEventListener(type, listener, this._oneTimeListeners);

        return this;
    }

    /**
     * Calls every listener registered for the event's type.
     */
    fire(event: EventType[EventNames<EventType>]): this;
    /**
     * Compatibility with the (type: string, properties: Object) signature from previous versions.
     * See https://github.com/mapbox/mapbox-gl-js/issues/6522,
     *     https://github.com/mapbox/mapbox-gl-draw/issues/766
     */
    fire(type: EventNames<EventType>, properties?: object): this;
    fire(event: EventType[EventNames<EventType>] | EventNames<EventType>, properties?: object): this {
        const firedEvent: Event = typeof event === 'string' ? new Event(event, properties || {}) : event;
        const type = firedEvent.type as EventNames<EventType>;

        if (this.listens(type)) {
            firedEvent.target = this;

            // make sure adding or removing listeners inside other listeners won't cause an infinite loop
            const listeners = this._listeners?.[type]?.slice() ?? [];
            for (const listener of listeners) {
                listener.call(this, firedEvent);
            }

            const oneTimeListeners = this._oneTimeListeners?.[type]?.slice() ?? [];
            for (const listener of oneTimeListeners) {
                _removeEventListener(type, listener, this._oneTimeListeners);
                listener.call(this, firedEvent);
            }

            const parent = this._eventedParent;
            if (parent) {
                extend(
                    firedEvent,
                    typeof this._eventedParentData === 'function' ? this._eventedParentData() : this._eventedParentData
                );
                parent.fire(firedEvent);
            }

        // To ensure that no error events are dropped, print them to the
        // console if they have no listeners.
        } else if (firedEvent instanceof ErrorEvent) {
            console.error(firedEvent.error);
        }

        return this;
    }

    /**
     * Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.
     *
     * @param type - The event type
     * @returns `true` if there is at least one registered listener for specified event type, `false` otherwise
     */
    listens(type: EventNames<EventType>): boolean {
        return Boolean(
            this._listeners?.[type]?.length ||
            this._oneTimeListeners?.[type]?.length ||
            this._eventedParent?.listens(type)
        );
    }

    /**
     * Bubble all events fired by this instance of Evented to this parent instance of Evented.
     */
    setEventedParent(parent?: Evented | null, data?: EventedParentData | (() => EventedParentData)): this {
        this._eventedParent = parent;
        this._eventedParentData = data;

        return this;
    }
}
