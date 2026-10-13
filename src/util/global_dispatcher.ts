import {Dispatcher} from './dispatcher.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {MessageType} from './actor_messages.ts';
import {type Subscription, warnOnce} from './util.ts';

import type {MessageHandler} from './actor.ts';
import type {RequestResponseMessageMap} from './actor_messages.ts';

/**
 * This is used to identify the global dispatcher in the workers, where it is the map id of the messages it sends.
 */
export const GLOBAL_DISPATCHER_ID = 'global-dispatcher';

let sharedGlobalDispatcher: Dispatcher | undefined;
let globalDispatcherClaims = 0;

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
    /** The scripts that were imported using this claim, which are imported again when the workers are replaced. */
    private scripts: Set<string> = new Set();
    private workersRestartSubscription: Subscription | undefined;

    constructor() {
        sharedGlobalDispatcher ||= new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
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
     * Registers a handler for messages that the workers send to the global dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    registerMessageHandler<T extends MessageType>(type: T, handler: CustomMessageHandler<RequestResponseMessageMap[T][0], RequestResponseMessageMap[T][1]>): Promise<void>;
    registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        return this.dispatcher.registerMessageHandler(type as MessageType, handler as MessageHandler<MessageType>);
    }

    unregisterMessageHandler(type: MessageType | string): Promise<void> {
        return this.dispatcher.unregisterMessageHandler(type as MessageType);
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
     * The script is kept in the workers for as long as this claim is held.
     * @param workerUrl - the worker url e.g. a url of a javascript file to load in the worker
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
     * const globalDispatcher = getGlobalDispatcher();
     * await globalDispatcher.importScript('add-protocol-worker.js');
     * ```
     */
    async importScript(workerUrl: string): Promise<void> {
        await this.dispatcher.broadcast(MessageType.importScript, workerUrl);
        this.scripts.add(workerUrl);
        this.workersRestartSubscription ||= this.dispatcher.on('workersrestart', this.importScriptsAgain);
    }

    /**
     * Imports the scripts of this claim into the workers that replaced the ones that had them.
     */
    private importScriptsAgain = (): void => {
        for (const url of this.scripts) {
            this.dispatcher.broadcast(MessageType.importScript, url).catch((error) => {
                warnOnce(`Failed to import script ${url} into the workers: ${error}`);
            });
        }
    };

    /**
     * Gives up this claim. When the last claim is released, and no map is left, the workers are terminated
     * and anything that was sent to them is lost, including the scripts that were imported.
     * Calling this more than once has no effect.
     */
    release(): void {
        if (this.released) return;
        this.released = true;
        this.workersRestartSubscription?.unsubscribe();
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
 * The workers are kept alive from the first call, even when all the maps are removed, since they hold the imported scripts.
 * @param workerUrl - the worker url e.g. a url of a javascript file to load in the worker
 * @deprecated Use {@link GlobalDispatcher.importScript} of the dispatcher that {@link getGlobalDispatcher} returns,
 * which allows releasing the workers when the script is no longer needed.
 *
 * @example
 * ```ts
 * importScriptInWorkers('add-protocol-worker.js');
 * ```
 */
export async function importScriptInWorkers(workerUrl: string): Promise<void> {
    const globalDispatcher = getGlobalDispatcher();
    try {
        await globalDispatcher.importScript(workerUrl);
    } catch (error) {
        globalDispatcher.release();
        throw error;
    }
}
