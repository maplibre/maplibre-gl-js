import {Actor, type ActorTarget, type MessageHandler} from './actor.ts';
import {getGlobalWorkerPool} from './global_worker_pool.ts';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax.ts';
import {MessageType} from './actor_messages.ts';
import {ErrorEvent, Evented, type ErrorEventType} from './evented.ts';
import {type Subscription, subscribe} from './util.ts';

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
     * Creates one actor per worker in the pool.
     * The global dispatcher is not a map, so it borrows the workers rather than keeping them alive.
     * Every other dispatcher brings the global one back first, since its workers answer their own
     * `getResource` requests through it.
     */
    private async initActors(mapId: string | number): Promise<Actor[]> {
        let workersPromise: Promise<ActorTarget[]>;
        if (mapId === GLOBAL_DISPATCHER_ID) {
            workersPromise = this.workerPool.borrow(dropGlobalDispatcher);
        } else {
            getGlobalDispatcher();
            workersPromise = this.workerPool.acquire(mapId);
        }
        const workers = await workersPromise;
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

/** Scripts sent to the workers by `importScriptInWorkers`, keyed by URL, so they can be re-sent to new workers. */
export const scriptsImportedIntoWorkers: Map<string, Promise<unknown>> = new Map();
const globalWorkerStateReplays: Array<() => void> = [];

/**
 * Registers state that lives in the workers rather than in any one map, so it can be put back when
 * the pool terminates its workers and a fresh global dispatcher is built around new ones.
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

/**
 * Discards the global dispatcher once the pool terminates its workers, since its actors now point at dead workers.
 * The next caller gets a fresh one built around whatever workers the pool creates next.
 */
function dropGlobalDispatcher(): void {
    globalDispatcher.remove(false);
    globalDispatcher = undefined;
}

onGlobalDispatcherCreated(() => {
    for (const url of Array.from(scriptsImportedIntoWorkers.keys())) {
        scriptsImportedIntoWorkers.set(url, getGlobalDispatcher().broadcast(MessageType.importScript, url));
    }
});
