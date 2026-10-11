import {Dispatcher} from './dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {MessageType} from './actor_messages.ts';
import {warnOnce} from './util.ts';

import type {Actor, MessageHandler} from './actor.ts';
import type {RequestResponseMessageMap} from './actor_messages.ts';

/**
 * This is used to identify the global dispatcher in the workers, where it is the map id of the messages it sends.
 */
export const GLOBAL_DISPATCHER_ID = 'global-dispatcher';

let sharedGlobalDispatcher: Dispatcher | undefined;
let globalDispatcherClaims = 0;
/** Every script url {@link importScriptInWorkers} has sent, so they can be sent again to new workers. */
const scriptsImportedInWorkers: Set<string> = new Set();

function createSharedGlobalDispatcher(): Dispatcher {
    const dispatcher = new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
    for (const url of scriptsImportedInWorkers) {
        dispatcher.broadcast(MessageType.importScript, url).catch((error) => {
            warnOnce(`Failed to import script ${url} into the workers: ${error}`);
        });
    }
    return dispatcher;
}

/**
 * A handler for a message that is not one of the built-in {@link MessageType}s, e.g. a message that is sent by a plugin.
 */
export type CustomMessageHandler<TData, TResult> = (mapId: string | number, params: TData, abortController?: AbortController) => Promise<TResult>;

/**
 * A claim on the dispatcher that is shared across all map instances, see {@link getGlobalDispatcher}.
 * The workers, and anything that was sent to them through this dispatcher, are kept for as long as the claim is held.
 * Call {@link GlobalDispatcher.release} when the state you have sent to the workers is no longer needed.
 */
export class GlobalDispatcher {
    private released: boolean = false;

    constructor() {
        sharedGlobalDispatcher ||= createSharedGlobalDispatcher();
        globalDispatcherClaims++;
    }

    private get dispatcher(): Dispatcher {
        if (this.released) throw new Error('This global dispatcher was released, use getGlobalDispatcher() to get a new one.');
        return sharedGlobalDispatcher;
    }

    /**
     * Broadcast a message to all Workers.
     * The type can be any string, to allow sending messages that are handled by a script that was imported using {@link importScriptInWorkers}.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>>;
    broadcast<TData = any, TResult = any>(type: string, data: TData): Promise<TResult[]>;
    broadcast(type: string, data: unknown): Promise<unknown[]> {
        return this.dispatcher.broadcast(type as MessageType, data as any);
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    getActor(): Promise<Actor> {
        return this.dispatcher.getActor();
    }

    /**
     * Registers a handler for messages that the workers send to the global dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void>;
    registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        return this.dispatcher.registerMessageHandler(type as MessageType, handler as MessageHandler<MessageType>);
    }

    unregisterMessageHandler(type: MessageType | string): Promise<void> {
        return this.dispatcher.unregisterMessageHandler(type as MessageType);
    }

    /**
     * Gives up this claim. When the last claim is released, and no map is left, the workers are terminated
     * and anything that was sent to them is lost, except for the scripts loaded using {@link importScriptInWorkers}.
     * Calling this more than once has no effect.
     */
    release(): void {
        if (this.released) return;
        this.released = true;
        globalDispatcherClaims--;
        if (globalDispatcherClaims > 0) return;
        sharedGlobalDispatcher.remove();
        sharedGlobalDispatcher = undefined;
    }
}

/**
 * This function is used to get the global dispatcher that is shared across all maps instances.
 * It is used by the main thread to send messages to the workers that are not related to a specific map.
 * If you import a script into the worker and need to send a message to the workers to pass some parameters for example,
 * you can use this function to get the global dispatcher and send a message to the workers.
 *
 * Every call returns a new claim that keeps the workers alive, even when all the maps are removed, until it is released.
 * Keep it for as long as the workers need to hold what you have sent them, and call {@link GlobalDispatcher.release} after that.
 * @returns A claim on the global dispatcher.
 *
 * @example
 * ```ts
 * const globalDispatcher = getGlobalDispatcher();
 * await globalDispatcher.broadcast('my-plugin-config', {tiles: 'https://example.com/{z}/{x}/{y}.png'});
 * // when the plugin is no longer in use
 * globalDispatcher.release();
 * ```
 */
export function getGlobalDispatcher(): GlobalDispatcher {
    return new GlobalDispatcher();
}

/**
 * Allows loading javascript code in the worker thread.
 * *Note* that since this is using some very internal classes and flows it is considered experimental and can break at any point.
 *
 * It can be useful for the following examples:
 * 1. Using `self.addProtocol` in the worker thread - note that you might need to also register the protocol on the main thread.
 * 2. Using `self.registerWorkerSource(workerSource: WorkerSource)` to register a worker source, which should come with `addSourceType` usually.
 * 3. using `self.actor.registerMessageHandler` to override some internal worker operations
 *
 * The script is imported again automatically whenever the workers are recreated, e.g. after all the maps were removed and a new one is created.
 * @param workerUrl - the worker url e.g. a url of a javascript file to load in the worker
 * @returns
 *
 * @example
 * ```ts
 * // below is an example of sending a js file to the worker to load the method there
 * // Note that you'll need to call the global function `addProtocol` in the worker to register the protocol there.
 * // add-protocol-worker.js
 * async function loadFn(params, abortController) {
 *     const t = await fetch(`https://${params.url.split("://")[1]}`);
 *     if (t.status == 200) {
 *         const buffer = await t.arrayBuffer();
 *         return {data: buffer}
 *     } else {
 *         throw new Error(`Tile fetch error: ${t.statusText}`);
 *     }
 * }
 * self.addProtocol('custom', loadFn);
 *
 * // main.js
 * importScriptInWorkers('add-protocol-worker.js');
 * ```
 */
export async function importScriptInWorkers(workerUrl: string): Promise<void> {
    const globalDispatcher = getGlobalDispatcher();
    scriptsImportedInWorkers.add(workerUrl);
    try {
        await globalDispatcher.broadcast(MessageType.importScript, workerUrl);
    } catch (error) {
        scriptsImportedInWorkers.delete(workerUrl);
        throw error;
    } finally {
        globalDispatcher.release();
    }
}
