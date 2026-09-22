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
    actorsPromise: Promise<Actor[]>;
    currentActor: number;
    id: string | number;
    private removed: boolean;
    private workerErrorSubscriptions: Subscription[];

    constructor(workerPool: WorkerPool, mapId: string | number) {
        super();
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        this.removed = false;
        this.workerErrorSubscriptions = [];
        this.actorsPromise = this.initActors(mapId);
    }

    /**
     * Creates one actor per worker. The global dispatcher borrows the workers rather than keeping
     * them alive; every other dispatcher revives it first, since workers answer `getResource` through it.
     */
    private async initActors(mapId: string | number): Promise<Actor[]> {
        let workers: ActorTarget[];
        if (mapId === GLOBAL_DISPATCHER_ID) {
            workers = await this.workerPool.borrow(() => {
                this.remove(false);
                globalDispatcher = undefined;
            });
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
            return actor;
        });
        if (!this.actors.length) throw new Error('No actors found');
        return this.actors;
    }

    /**
     * Broadcast a message to all Workers.
     */
    async broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>> {
        const actors = await this.actorsPromise;
        return Promise.all(actors.map(actor => actor.sendAsync({type, data})));
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    async getActor(): Promise<Actor> {
        const actors = await this.actorsPromise;
        this.currentActor = (this.currentActor + 1) % actors.length;
        return actors[this.currentActor];
    }

    async waitForInitComplete(): Promise<void> {
        if (this.actors.length === 0) {
            await this.actorsPromise;
        }
    }

    getReadyActor(): Actor {
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }

    remove(mapRemoved: boolean = true): void {
        this.removed = true;
        for (const actor of this.actors) {
            actor.remove();
        }
        for (const subscription of this.workerErrorSubscriptions) {
            subscription.unsubscribe();
        }
        this.actors = [];
        this.workerErrorSubscriptions = [];
        this.setEventedParent(null);
        if (mapRemoved) this.workerPool.release(this.id);
    }

    public async registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void> {
        const actors = await this.actorsPromise;
        for (const actor of actors) {
            actor.registerMessageHandler(type, handler);
        }
    }

    public async unregisterMessageHandler<T extends MessageType>(type: T): Promise<void> {
        const actors = await this.actorsPromise;
        for (const actor of actors) {
            actor.unregisterMessageHandler(type);
        }
    }
}

let globalDispatcher: Dispatcher;

/**
 * Latest import attempt per script url sent by `importScriptInWorkers`, kept so the scripts can be
 * re-sent to new workers. A failed attempt leaves `undefined` so the next call retries.
 */
export const scriptsImportedIntoWorkers: Map<string, Promise<unknown> | undefined> = new Map();
const globalWorkerStateReplays: Array<() => void> = [];

/**
 * Registers a callback that restores state living in the workers rather than in any one map.
 * It runs each time a global dispatcher is created, including the first.
 */
export function onGlobalDispatcherCreated(replay: () => void): void {
    globalWorkerStateReplays.push(replay);
}

/**
 * This function is used to get the global dispatcher that is shared across all maps instances.
 * It is used by the main thread to send messages to the workers, and by the workers to send messages back to the main thread.
 * If you import a script into the worker and need to send a message to the workers to pass some parameters for example,
 * you can use this function to get the global dispatcher and send a message to the workers.
 *
 * Creating it also replays everything registered with `onGlobalDispatcherCreated`.
 * @returns The global dispatcher instance.
 */
export function getGlobalDispatcher(): Dispatcher {
    if (!globalDispatcher) {
        globalDispatcher = new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
        globalDispatcher.registerMessageHandler(MessageType.getResource, (_mapId, params, abortController) => {
            return makeRequest(params, abortController);
        });
        for (const replay of globalWorkerStateReplays) {
            replay();
        }
    }
    return globalDispatcher;
}

export function broadcastImportScript(url: string): Promise<unknown> {
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

onGlobalDispatcherCreated(() => {
    for (const url of Array.from(scriptsImportedIntoWorkers.keys())) {
        broadcastImportScript(url);
    }
});
