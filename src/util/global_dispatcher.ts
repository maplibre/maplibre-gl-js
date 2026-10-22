import {createActors} from './actor.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax.ts';
import {MessageType} from './actor_messages.ts';
import {type ErrorEvent, Evented, type Event} from './evented.ts';
import {warnOnce} from './util.ts';
import {isAbortError, throwIfAborted} from './abort_error.ts';

import type {Actor, MessageHandler} from './actor.ts';
import type {WorkerPool} from './worker_pool.ts';
import type {RequestResponseMessageMap} from './actor_messages.ts';

export type GlobalDispatcherEventType = {
    /**
     * Fires each time the global workers are created, including the first. Removing the last map
     * terminates them unless `prewarm()` holds them, so a listener here is the place to restore
     * state that lives in the workers rather than in any one map.
     *
     * Message handlers registered through {@link getGlobalDispatcher} and scripts loaded through
     * {@link importScriptInWorkers} come back on their own and do not need this.
     *
     * @example
     * ```ts
     * getGlobalDispatcher().on('workerscreate', () => {
     *     getGlobalDispatcher().broadcast('my-plugin-config', {tiles: 'https://example.com/{z}/{x}/{y}.png'});
     * });
     * ```
     */
    workerscreate: Event;
    error: ErrorEvent;
};

/**
 * A handler for a message that is not one of the built-in {@link MessageType}s, e.g. a message that is sent by a plugin.
 */
export type CustomMessageHandler<TData, TResult> = (mapId: string | number, params: TData, abortController?: AbortController) => Promise<TResult>;

/**
 * How long the workers get to answer a ping before they are considered terminated. The ping
 * queues ahead of tile work on return to the foreground, so the budget only needs to cover one
 * in-flight tile parse on slow hardware. A false timeout restarts healthy workers and drops map
 * state, so err on the large side.
 */
const PING_TIMEOUT_MS = 500;

/**
 * The dispatcher shared across all map instances, see {@link getGlobalDispatcher}. Unlike a map's
 * dispatcher it never claims the workers: it builds actors for whichever workers the pool is
 * running, and discards them when the pool terminates those workers.
 */
export class GlobalDispatcher extends Evented<GlobalDispatcherEventType> {
    /** Every script url {@link importScriptInWorkers} has sent, so they can be sent again to new workers. */
    private importedScriptUrls = new Set<string>();
    private messageHandlers: Record<string, MessageHandler<MessageType>> = {};
    /** The actors on the pool's current workers, built on first use and cleared when those workers terminate. */
    private actorsPromise: Promise<Actor[]> | undefined;
    private workersAbortController: AbortController | undefined;
    private workerPool: WorkerPool;
    private watchingWorkers = false;
    private ensureWorkersPromise: Promise<void> | undefined;

    /**
     * Builds actors on the pool's workers as soon as they exist, including workers started before
     * construction, e.g. by prewarm(), so that messages the workers send find their handlers.
     */
    constructor(workerPool: WorkerPool) {
        super();
        this.workerPool = workerPool;
        workerPool.on('create', () => this.buildActorsInBackground());
        workerPool.on('terminate', () => this.handleWorkersTerminated());
        if (workerPool.isStarted()) this.buildActorsInBackground();
    }

    private async buildActorsInBackground(): Promise<void> {
        try {
            await this.getActors();
        } catch (error) {
            if (!isAbortError(error)) warnOnce(`Failed to connect to the workers: ${error}`);
        }
    }

    private handleWorkersTerminated(): void {
        this.workersAbortController?.abort(new Error('The workers were terminated while a message was in flight.'));
        this.actorsPromise = undefined;
    }

    /** Returns the actors on the pool's current workers, starting the workers if none are running. */
    private getActors(): Promise<Actor[]> {
        this.actorsPromise ??= this.buildActors();
        return this.actorsPromise;
    }

    /**
     * Builds an actor per worker with the registered message handlers, and sends the imported
     * scripts ahead of anything else, so a message for a script never reaches a worker before it.
     * Rejects with an `AbortError` if the workers terminate before they are created.
     */
    private async buildActors(): Promise<Actor[]> {
        const abortController = new AbortController();
        this.workersAbortController = abortController;
        const workers = await this.workerPool.start();
        throwIfAborted(abortController.signal);

        const {actors, workerErrorSubscriptions} = createActors(workers, GLOBAL_DISPATCHER_ID, this);
        abortController.signal.addEventListener('abort', () => {
            for (const actor of actors) actor.remove();
            for (const subscription of workerErrorSubscriptions) subscription.unsubscribe();
        }, {once: true});
        for (const actor of actors) {
            for (const [type, handler] of Object.entries(this.messageHandlers)) {
                actor.registerMessageHandler(type as MessageType, handler);
            }
        }
        for (const url of this.importedScriptUrls) {
            this.importScriptInto(actors, abortController, url);
        }
        this.fire('workerscreate');
        return actors;
    }

    /** Returns the actors already built or being built, without starting any workers. */
    private async getBuiltActors(): Promise<Actor[]> {
        try {
            return (await this.actorsPromise) ?? [];
        } catch {
            // The workers terminated first, and the next actors pick up messageHandlers.
            return [];
        }
    }

    private async importScriptInto(actors: Actor[], abortController: AbortController, url: string): Promise<void> {
        try {
            await Promise.all(actors.map(actor => actor.sendAsync({type: MessageType.importScript, data: url}, abortController)));
        } catch (error) {
            warnOnce(`Failed to import script ${url} into the workers: ${error}`);
        }
    }

    /**
     * Broadcast a message to all Workers.
     * The type can be any string, to allow sending messages that are handled by a script that was imported using {@link importScriptInWorkers}.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>>;
    broadcast<TData = any, TResult = any>(type: string, data: TData): Promise<TResult[]>;
    async broadcast(type: string, data: any): Promise<unknown[]> {
        const actorsPromise = this.getActors();
        // Read before awaiting: once these workers terminate, the field holds the next workers' controller.
        const abortController = this.workersAbortController;
        const actors = await actorsPromise;
        throwIfAborted(abortController.signal);
        return Promise.all(actors.map(actor => actor.sendAsync({type: type as MessageType, data}, abortController)));
    }

    /**
     * Registers a handler for messages that the workers send to this dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void>;
    registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    async registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        this.messageHandlers[type] = handler;
        for (const actor of await this.getBuiltActors()) {
            actor.registerMessageHandler(type as MessageType, handler);
        }
    }

    async unregisterMessageHandler(type: MessageType | string): Promise<void> {
        delete this.messageHandlers[type];
        for (const actor of await this.getBuiltActors()) {
            actor.unregisterMessageHandler(type as MessageType);
        }
    }

    /**
     * See {@link importScriptInWorkers}. A url may be broadcast more than once, e.g. when this
     * call is what creates the workers; the worker runs each url only once.
     */
    async importScript(workerUrl: string): Promise<void> {
        this.importedScriptUrls.add(workerUrl);
        await this.broadcast(MessageType.importScript, workerUrl);
    }

    /**
     * Pings the workers on every return to the foreground, restarting them if the browser
     * terminated them while the page was hidden, as iOS does under memory pressure. Browsers fire no
     * event for the termination, so the ping is the only way to notice it. Each map then
     * recovers through the same contract as a lost WebGL context, see `Map._handleWorkersRestarted`.
     */
    watchWorkers(): void {
        if (this.watchingWorkers || typeof document === 'undefined') return;
        this.watchingWorkers = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.ensureWorkers();
        }, false);
    }

    /**
     * Restarts the workers if they don't answer a ping, for apps that learn of a return to the
     * foreground some other way. Calls made while a check is running share that check.
     */
    ensureWorkers(): Promise<void> {
        this.ensureWorkersPromise ??= this.ensureWorkersInternal();
        return this.ensureWorkersPromise;
    }

    private async ensureWorkersInternal(): Promise<void> {
        try {
            if (!await this.ping()) await this.workerPool.restart();
        } finally {
            this.ensureWorkersPromise = undefined;
        }
    }

    /**
     * Pings the workers, resolving false only on silence: any answer, even an error, proves they
     * are alive. Resolves true when no workers exist, since there is nothing to restart.
     */
    async ping(timeoutMs: number = PING_TIMEOUT_MS): Promise<boolean> {
        if (!this.workerPool.isStarted()) return true;
        let timer: ReturnType<typeof setTimeout>;
        try {
            return await Promise.race([
                this.answersPing(),
                new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); })
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Resolves true once the workers answer a ping, whether with a result or an error. */
    private async answersPing(): Promise<boolean> {
        try {
            await this.broadcast(MessageType.ping, undefined);
        } catch {
            // An error is still an answer.
        }
        return true;
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
 * you broadcast into the workers does not, so send that from a `workerscreate` listener.
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
