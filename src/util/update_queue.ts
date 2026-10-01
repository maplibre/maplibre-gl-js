/**
 * The functions an {@link UpdateQueue} calls for each update.
 */
export type UpdateQueueHandlers<T, R> = {
    /**
     * Sends an update. The next one is not sent before the returned promise settles.
     */
    send: (update: T) => Promise<R>;
    /**
     * Called with the result of an update, once it is no longer being sent.
     * `replaced` is whether {@link UpdateQueue#replace} was called while the update was being sent, in which case
     * the result describes a state that has since been replaced.
     */
    onResult: (update: T, result: R, replaced: boolean) => void;
    /**
     * Called when sending an update, or handling its result, failed.
     */
    onError: (update: T, error: unknown) => void;
};

/**
 * Sends updates one at a time, in the order they were queued.
 * An update that is still waiting can be changed in place, through {@link UpdateQueue#top}, until it is sent.
 */
export class UpdateQueue<T, R> {
    private readonly _handlers: UpdateQueueHandlers<T, R>;
    private _waiting: T[] = [];
    private _sending = false;
    /**
     * Whether {@link UpdateQueue#replace} was called since the update being sent was sent.
     */
    private _replacedWhileSending = false;
    /**
     * What every {@link UpdateQueue#flush} call returns until the queue is idle again.
     * It is created by the first flush after the queue was idle, shared by the flushes that follow,
     * and resolved and cleared once no update is left, so it is only set while a flush is in progress.
     */
    private _flushing: {promise: Promise<void>; resolve: () => void} | undefined;

    constructor(handlers: UpdateQueueHandlers<T, R>) {
        this._handlers = handlers;
    }

    /**
     * Whether no update is being sent or waiting to be.
     */
    isIdle(): boolean {
        return !this._sending && this._waiting.length === 0;
    }

    /**
     * The update queued last, if it is still waiting to be sent.
     * The update being sent is not waiting, so it is never returned.
     */
    top(): T | undefined {
        return this._waiting.length ? this._waiting[this._waiting.length - 1] : undefined;
    }

    /**
     * Queues an update without sending it.
     */
    enqueue(update: T): void {
        this._waiting.push(update);
    }

    /**
     * Drops the waiting updates and queues this one instead.
     */
    replace(update: T): void {
        this._waiting = [update];
        this._replacedWhileSending = this._sending;
    }

    /**
     * Drops the waiting updates. The update being sent, if any, still runs to its end.
     */
    clear(): void {
        this._waiting = [];
    }

    /**
     * Sends the waiting updates.
     * @returns a promise that resolves once no update is being sent or waiting to be.
     */
    flush(): Promise<void> {
        if (this.isIdle()) return Promise.resolve();
        if (!this._flushing) {
            let resolve: () => void;
            const promise = new Promise<void>((r) => { resolve = r; });
            this._flushing = {promise, resolve};
        }
        const {promise} = this._flushing;
        this._next();
        return promise;
    }

    private _next(): void {
        if (this._sending) return;
        const update = this._waiting.shift();
        if (update === undefined) {
            this._flushing?.resolve();
            this._flushing = undefined;
            return;
        }
        this._sending = true;
        this._replacedWhileSending = false;
        this._handlers.send(update)
            .then((result) => {
                this._sending = false;
                this._handlers.onResult(update, result, this._replacedWhileSending);
            })
            .catch((error: unknown) => {
                this._sending = false;
                this._handlers.onError(update, error);
            })
            .finally(() => this._next());
    }
}
