import {createActors} from './actor.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax.ts';
import {MessageType} from './actor_messages.ts';
import {type ErrorEvent, Evented, type Event} from './evented.ts';
import {warnOnce, type Subscription} from './util.ts';

import type {Actor, MessageHandler} from './actor.ts';
import type {WorkerPool} from './worker_pool.ts';
import type {RequestResponseMessageMap} from './actor_messages.ts';

export type GlobalDispatcherEventType = {
    /**
     * Fires each time the global workers are created, including the first. Removing the last map
     * terminates them, so a listener here is the place to restore state that lives in the workers
     * rather than in any one map.
     *
     * Message handlers registered through {@link getGlobalDispatcher} and scripts loaded through
     * {@link importScriptInWorkers} come back on their own and do not need this.
     *
     * @example
     * ```ts
     * getGlobalDispatcher().on('workersCreated', () => {
     *     getGlobalDispatcher().broadcast('my-plugin-config', {tiles: 'https://example.com/{z}/{x}/{y}.png'});
     * });
     * ```
     */
    workersCreated: Event;
    error: ErrorEvent;
};

/**
 * A handler for a message that is not one of the built-in {@link MessageType}s, e.g. a message that is sent by a plugin.
 */
export type CustomMessageHandler<TData, TResult> = (mapId: string | number, params: TData, abortController?: AbortController) => Promise<TResult>;

/** How long the workers get to answer a ping before they are considered terminated. */
const WORKER_PING_TIMEOUT_MS = 2000;

/**
 * The dispatcher shared across all map instances, see {@link getGlobalDispatcher}. Unlike a map's
 * dispatcher it never claims the workers: its actors live and die with them, rebuilt from the
 * pool's `create` event and discarded on `terminate`.
 */
export class GlobalDispatcher extends Evented<GlobalDispatcherEventType> {
    /** Every script url {@link importScriptInWorkers} has sent, so they can be sent again to new workers. */
    private importedScriptUrls = new Set<string>();
    private messageHandlers: Record<string, MessageHandler<MessageType>> = {};
    private actorsPromise: Promise<Actor[]> | undefined;
    private workerErrorSubscriptions: Subscription[] = [];
    private workerPool: WorkerPool;
    /** Rejects when the current workers terminate, so in-flight broadcasts reject instead of hanging. */
    private workersTerminated: Promise<never>;
    private rejectInFlightBroadcasts: (error: Error) => void;
    private watchingWorkerHealth = false;
    private healthCheckInFlight = false;

    /**
     * Workers created before construction, e.g. by prewarm() before this module evaluated, fired
     * `create` already, so the constructor handles them directly.
     */
    constructor(workerPool: WorkerPool) {
        super();
        this.workerPool = workerPool;
        workerPool.on('create', () => this.handleWorkersCreated());
        workerPool.on('terminate', () => this.handleWorkersTerminated());
        if (workerPool.workersPromise) this.handleWorkersCreated();
    }

    private handleWorkersCreated(): void {
        this.actorsPromise = this.buildActors();
        this.workersTerminated = new Promise((_, reject) => { this.rejectInFlightBroadcasts = reject; });
        this.workersTerminated.catch(() => {});
        for (const url of this.importedScriptUrls) {
            this.broadcast(MessageType.importScript, url).catch((error) => {
                warnOnce(`Failed to import script ${url} into the workers: ${error}`);
            });
        }
        this.fire('workersCreated');
    }

    private handleWorkersTerminated(): void {
        this.actorsPromise?.then((actors) => {
            for (const actor of actors) {
                actor.remove();
            }
        }).catch(() => {});
        this.actorsPromise = undefined;
        this.rejectInFlightBroadcasts(new Error('The workers were terminated while a message was in flight.'));
        for (const subscription of this.workerErrorSubscriptions) {
            subscription.unsubscribe();
        }
        this.workerErrorSubscriptions = [];
    }

    /** Returns the actors, creating the workers on first use: `ensureWorkers` fires the pool's `create` event synchronously. */
    private getActors(): Promise<Actor[]> {
        this.workerPool.ensureWorkers();
        return this.actorsPromise;
    }

    private async buildActors(): Promise<Actor[]> {
        const workers = await this.workerPool.ensureWorkers();
        const {actors, workerErrorSubscriptions} = createActors(workers, GLOBAL_DISPATCHER_ID, this);
        this.workerErrorSubscriptions = workerErrorSubscriptions;
        for (const actor of actors) {
            for (const [type, handler] of Object.entries(this.messageHandlers)) {
                actor.registerMessageHandler(type as MessageType, handler);
            }
        }
        return actors;
    }

    /**
     * Broadcast a message to all Workers.
     * The type can be any string, to allow sending messages that are handled by a script that was imported using {@link importScriptInWorkers}.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>>;
    broadcast<TData = any, TResult = any>(type: string, data: TData): Promise<TResult[]>;
    async broadcast(type: string, data: any): Promise<unknown[]> {
        const actorsPromise = this.getActors();
        const workersTerminated = this.workersTerminated;
        const actors = await actorsPromise;
        return Promise.race([
            Promise.all(actors.map(actor => actor.sendAsync({type: type as MessageType, data}))),
            workersTerminated
        ]);
    }

    /**
     * Registers a handler for messages that the workers send to this dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void>;
    registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    async registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        this.messageHandlers[type] = handler;
        for (const actor of (await this.actorsPromise) ?? []) {
            actor.registerMessageHandler(type as MessageType, handler);
        }
    }

    async unregisterMessageHandler(type: MessageType | string): Promise<void> {
        delete this.messageHandlers[type];
        for (const actor of (await this.actorsPromise) ?? []) {
            actor.unregisterMessageHandler(type as MessageType);
        }
    }

    /**
     * See {@link importScriptInWorkers}. A url may be broadcast more than once, e.g. by the
     * creation replay; the worker runs each url only once.
     */
    async importScript(workerUrl: string): Promise<void> {
        this.importedScriptUrls.add(workerUrl);
        await this.broadcast(MessageType.importScript, workerUrl);
    }

    /**
     * Checks worker health on every return to the foreground, restarting the workers if the browser
     * terminated them while the page was hidden, as iOS does under memory pressure. Browsers fire no
     * event for the termination, so the health check is the only way to notice it.
     */
    watchWorkerHealth(): void {
        if (this.watchingWorkerHealth || typeof document === 'undefined') return;
        this.watchingWorkerHealth = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.restartWorkersIfTerminated();
        }, false);
    }

    /**
     * Restarts the shared workers unless every one answers a ping in time. Any answer, even an
     * error, proves the worker is alive; only silence means the browser terminated it. Each map
     * then recovers through the same contract as a lost WebGL context, see
     * `Map._handleWorkersCreated`.
     */
    async restartWorkersIfTerminated(timeoutMs: number = WORKER_PING_TIMEOUT_MS): Promise<void> {
        if (this.healthCheckInFlight || !this.workerPool.workersPromise) return;
        this.healthCheckInFlight = true;
        let timer: ReturnType<typeof setTimeout>;
        try {
            const alive = await Promise.race([
                this.broadcast(MessageType.ping, undefined).then(() => true, () => true),
                new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); })
            ]);
            if (!alive) this.workerPool.restart();
        } finally {
            clearTimeout(timer);
            this.healthCheckInFlight = false;
        }
    }
}

let globalDispatcher: GlobalDispatcher;

/**
 * This function is used to get the global dispatcher that is shared across all maps instances.
 * It is used by the main thread to send messages to the workers, and by the workers to send messages back to the main thread.
 * If you import a script into the worker and need to send a message to the workers to pass some parameters for example,
 * you can use this function to get the global dispatcher and send a message to the workers.
 *
 * The same dispatcher is returned for the life of the page, so it is safe to keep, and the message
 * handlers registered on it come back on the workers that replace terminated ones. Configuration
 * you broadcast into the workers does not, so send that from a `workersCreated` listener.
 * @returns The global dispatcher instance.
 */
export function getGlobalDispatcher(): GlobalDispatcher {
    if (!globalDispatcher) {
        globalDispatcher = new GlobalDispatcher(getGlobalWorkerPool());
        globalDispatcher.registerMessageHandler(MessageType.getResource, (_mapId, params, abortController) => {
            return makeRequest(params, abortController);
        });
    }
    return globalDispatcher;
}
