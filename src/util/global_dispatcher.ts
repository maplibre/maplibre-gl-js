import {Dispatcher, type CustomMessageHandler} from './dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax.ts';
import {MessageType} from './actor_messages.ts';
import {Evented, type Event} from './evented.ts';
import {warnOnce} from './util.ts';

import type {MessageHandler} from './actor.ts';
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
};

/**
 * The dispatcher shared across all map instances, see {@link getGlobalDispatcher}. Unlike a map's
 * dispatcher, its use of the workers is not a claim: its actors live and die with them.
 */
export class GlobalDispatcher extends Evented<GlobalDispatcherEventType> {
    /** Every script url {@link importScriptInWorkers} has sent, so they can be sent again to new workers. */
    private importedScriptUrls = new Set<string>();
    private dispatcher: Dispatcher;

    constructor(workerPool: WorkerPool) {
        super();
        this.dispatcher = new Dispatcher({
            acquire: () => workerPool.ensureWorkers(),
            release: () => {}
        }, GLOBAL_DISPATCHER_ID);
        workerPool.on('terminate', () => this.dispatcher.discardActors());
        workerPool.on('create', () => {
            this.dispatcher.getActors();
            for (const url of this.importedScriptUrls) {
                this.dispatcher.broadcast(MessageType.importScript, url).catch((error) => {
                    warnOnce(`Failed to import script ${url} into the workers: ${error}`);
                });
            }
            this.fire('workersCreated');
        });
        // Workers created before this module evaluated, e.g. by prewarm(), fired `create` already.
        if (workerPool.workersPromise) this.dispatcher.getActors();
    }

    /**
     * Broadcast a message to all Workers.
     * The type can be any string, to allow sending messages that are handled by a script that was imported using {@link importScriptInWorkers}.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>>;
    broadcast<TData = any, TResult = any>(type: string, data: TData): Promise<TResult[]>;
    broadcast(type: string, data: unknown): Promise<unknown[]> {
        return this.dispatcher.broadcast(type, data);
    }

    /**
     * Registers a handler for messages that the workers send to this dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void>;
    registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        return this.dispatcher.registerMessageHandler(type, handler);
    }

    unregisterMessageHandler(type: MessageType | string): Promise<void> {
        return this.dispatcher.unregisterMessageHandler(type);
    }

    /**
     * See {@link importScriptInWorkers}. A url may be broadcast more than once, e.g. by the
     * creation replay; the worker runs each url only once.
     */
    async importScript(workerUrl: string): Promise<void> {
        this.importedScriptUrls.add(workerUrl);
        await this.dispatcher.broadcast(MessageType.importScript, workerUrl);
    }
}

const globalDispatcher = new GlobalDispatcher(getGlobalWorkerPool());
globalDispatcher.registerMessageHandler(MessageType.getResource, (_mapId, params, abortController) => {
    return makeRequest(params, abortController);
});

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
    return globalDispatcher;
}

