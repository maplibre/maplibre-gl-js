import {Actor, type MessageHandler} from './actor';
import {getGlobalWorkerPool} from './global_worker_pool';
import {GLOBAL_DISPATCHER_ID, makeRequest} from './ajax';

import type {WorkerPool} from './worker_pool';
import type {RequestResponseMessageMap} from './actor_messages';
import {MessageType} from './actor_messages';

/**
 * Responsible for sending messages from a {@link Source} to an associated worker source (usually with the same name).
 */
export class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: string | number;

    constructor(workerPool: WorkerPool, mapId: string | number) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        const workers = this.workerPool.acquire(mapId);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Actor(worker, mapId);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
        if (!this.actors.length) throw new Error('No actors found');
    }

    /**
     * Broadcast a message to all Workers.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<RequestResponseMessageMap[T][1][]> {
        const promises: Promise<RequestResponseMessageMap[T][1]>[] = [];
        for (const actor of this.actors) {
            promises.push(actor.sendAsync({type, data}));
        }
        return Promise.all(promises);
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    getActor(): Actor {
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }

    remove(mapRemoved: boolean = true) {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
        if (mapRemoved) this.workerPool.release(this.id);
    }

    public registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>) {
        for (const actor of this.actors) {
            actor.registerMessageHandler(type, handler);
        }
    }

    public unregisterMessageHandler<T extends MessageType>(type: T) {
        for (const actor of this.actors) {
            actor.unregisterMessageHandler(type);
        }
    }
}

let globalDispatcher: Dispatcher;

export function getGlobalDispatcher(): Dispatcher {
    if (!globalDispatcher) {
        globalDispatcher = new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
        globalDispatcher.registerMessageHandler(MessageType.getResource, (_mapId, params, abortController) => {
            return makeRequest(params, abortController);
        });
    }
    return globalDispatcher;
}
