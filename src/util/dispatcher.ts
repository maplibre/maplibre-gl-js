import {Actor, type ActorTarget, type MessageHandler} from './actor.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax.ts';
import {MessageType} from './actor_messages.ts';
import {ErrorEvent, Evented, type ErrorEventType} from './evented.ts';
import {type Subscription, subscribe, warnOnce} from './util.ts';

import type {WorkerPool} from './worker_pool.ts';
import type {RequestResponseMessageMap} from './actor_messages.ts';

/**
 * Responsible for sending messages from a {@link Source} to an associated worker source (usually with the same name).
 */
export class Dispatcher extends Evented<ErrorEventType> {
    workerPool: WorkerPool;
    actors: Actor[];
    actorsPromise: Promise<Actor[]> | undefined;
    currentActor: number;
    id: string | number;
    private messageHandlers: {[K in MessageType]?: MessageHandler<K>};
    private removed: boolean;
    private workerErrorSubscriptions: Subscription[];

    /**
     * The global dispatcher builds its actors from {@link getGlobalDispatcher} instead, once the
     * instance is reachable, since replaying worker state can call back into it.
     */
    constructor(workerPool: WorkerPool, mapId: string | number) {
        super();
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        this.messageHandlers = {};
        this.removed = false;
        this.workerErrorSubscriptions = [];
        if (mapId !== GLOBAL_DISPATCHER_ID) this.getActors();
    }

    /**
     * Creates one actor per worker, carrying over the message handlers registered so far. The global
     * dispatcher weakly acquires the workers rather than keeping them alive. Every other dispatcher
     * revives it first, since workers answer `getResource` through it.
     */
    private async initActors(mapId: string | number): Promise<Actor[]> {
        let workers: ActorTarget[];
        if (mapId === GLOBAL_DISPATCHER_ID) {
            workers = await this.workerPool.weakAcquire(() => this.discardActors());
        } else {
            getGlobalDispatcher();
            workers = await this.workerPool.acquire(mapId);
        }
        if (this.removed) return [];
        this.actors = workers.map((worker: ActorTarget, i: number) => {
            this.workerErrorSubscriptions.push(subscribe(worker, 'error', () => {
                this.fire(new ErrorEvent(new Error('Worker failed to load. Check that the worker URL is correct.')));
            }, false));
            const actor = new Actor(worker, mapId);
            actor.name = `Worker ${i}`;
            for (const [type, handler] of Object.entries(this.messageHandlers)) {
                actor.registerMessageHandler(type as MessageType, handler);
            }
            return actor;
        });
        if (!this.actors.length) throw new Error('No actors found');
        return this.actors;
    }

    /** Drops the actors whose workers are being terminated, leaving the dispatcher ready to build more. */
    private discardActors(): void {
        for (const actor of this.actors) {
            actor.remove();
        }
        for (const subscription of this.workerErrorSubscriptions) {
            subscription.unsubscribe();
        }
        this.actors = [];
        this.workerErrorSubscriptions = [];
        this.actorsPromise = undefined;
    }

    /**
     * The actors to send through, built again if the workers behind the last ones were terminated.
     * A removed dispatcher has none and never will, so messages sent to one go nowhere.
     */
    getActors(): Promise<Actor[]> {
        if (this.removed) return Promise.resolve([]);
        if (!this.actorsPromise) {
            this.actorsPromise = this.initActors(this.id);
            if (this.id === GLOBAL_DISPATCHER_ID) {
                for (const listener of globalWorkersCreatedListeners.slice()) {
                    listener();
                }
            }
        }
        return this.actorsPromise;
    }

    /**
     * Broadcast a message to all Workers.
     */
    async broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>> {
        const actors = await this.getActors();
        return Promise.all(actors.map(actor => actor.sendAsync({type, data})));
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    async getActor(): Promise<Actor> {
        const actors = await this.getActors();
        this.currentActor = (this.currentActor + 1) % actors.length;
        return actors[this.currentActor];
    }

    async waitForInitComplete(): Promise<void> {
        if (this.actors.length === 0) {
            await this.getActors();
        }
    }

    getReadyActor(): Actor {
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }

    remove({releaseWorkers = true}: {releaseWorkers?: boolean} = {}): void {
        this.removed = true;
        this.discardActors();
        this.setEventedParent(null);
        if (releaseWorkers) this.workerPool.release(this.id);
    }

    public async registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void> {
        (this.messageHandlers as Record<T, MessageHandler<T>>)[type] = handler;
        const actors = await this.getActors();
        for (const actor of actors) {
            actor.registerMessageHandler(type, handler);
        }
    }

    public async unregisterMessageHandler<T extends MessageType>(type: T): Promise<void> {
        delete this.messageHandlers[type];
        const actors = await this.getActors();
        for (const actor of actors) {
            actor.unregisterMessageHandler(type);
        }
    }
}

let globalDispatcher: Dispatcher;

/**
 * Latest import attempt per script url sent by {@link importScriptInWorkers}, kept so the scripts
 * can be re-sent to new workers. A failed attempt leaves `undefined` so the next call retries.
 * Entries are refreshed by the listener below, which is why `getGlobalDispatcher()` has to run
 * its listeners synchronously before {@link importScriptInWorkers} reads this.
 */
const scriptsImportedIntoWorkers: Map<string, Promise<unknown> | undefined> = new Map();
const globalWorkersCreatedListeners: Array<() => void> = [];

/**
 * Registers a callback that restores state living in the workers rather than in any one map.
 * It runs each time the global workers are created, including the first, since new workers start
 * out knowing nothing. Removing the last map terminates them, so anything a plugin configures in
 * the workers belongs here rather than in one-time setup code.
 *
 * Message handlers registered through {@link getGlobalDispatcher} and scripts loaded through
 * {@link importScriptInWorkers} come back on their own and do not need this.
 * @param listener - sends the worker configuration again
 * @returns a subscription object that can be used to stop sending it
 *
 * @example
 * ```ts
 * onGlobalWorkersCreated(() => {
 *     getGlobalDispatcher().broadcast('my-plugin-config', {tiles: 'https://example.com/{z}/{x}/{y}.png'});
 * });
 * ```
 */
export function onGlobalWorkersCreated(listener: () => void): Subscription {
    globalWorkersCreatedListeners.push(listener);
    return {
        unsubscribe: () => {
            const index = globalWorkersCreatedListeners.indexOf(listener);
            if (index !== -1) globalWorkersCreatedListeners.splice(index, 1);
        }
    };
}

/**
 * This function is used to get the global dispatcher that is shared across all maps instances.
 * It is used by the main thread to send messages to the workers, and by the workers to send messages back to the main thread.
 * If you import a script into the worker and need to send a message to the workers to pass some parameters for example,
 * you can use this function to get the global dispatcher and send a message to the workers.
 *
 * The same dispatcher is returned for the life of the page, so it is safe to keep, and the message
 * handlers registered on it come back on the workers that replace terminated ones. Configuration
 * you broadcast into the workers does not, so send that from {@link onGlobalWorkersCreated}.
 * @returns The global dispatcher instance.
 */
export function getGlobalDispatcher(): Dispatcher {
    if (!globalDispatcher) {
        globalDispatcher = new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
        globalDispatcher.registerMessageHandler(MessageType.getResource, (_mapId, params, abortController) => {
            return makeRequest(params, abortController);
        });
    }
    globalDispatcher.getActors();
    return globalDispatcher;
}

function broadcastImportScript(url: string): Promise<unknown> {
    const importPromise = getGlobalDispatcher().broadcast(MessageType.importScript, url);
    scriptsImportedIntoWorkers.set(url, importPromise);
    importPromise.catch((error) => {
        warnOnce(`Failed to import script ${url} into the workers: ${error}`);
        if (scriptsImportedIntoWorkers.get(url) === importPromise) {
            scriptsImportedIntoWorkers.set(url, undefined);
        }
    });
    return importPromise;
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
 * Each url is imported once; calling this again with the same url waits for the first import.
 * The scripts are imported again automatically whenever the pooled workers are recreated.
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
    getGlobalDispatcher();
    await (scriptsImportedIntoWorkers.get(workerUrl) ?? broadcastImportScript(workerUrl));
}

onGlobalWorkersCreated(() => {
    for (const url of Array.from(scriptsImportedIntoWorkers.keys())) {
        broadcastImportScript(url);
    }
});
