import {type Actor, createActors, type MessageHandler} from './actor.ts';
import {Evented, type ErrorEventType} from './evented.ts';

import type {Subscription} from './util.ts';
import type {WorkerPool} from './worker_pool.ts';
import type {MessageType, RequestResponseMessageMap} from './actor_messages.ts';

/**
 * Responsible for sending messages from a {@link Source} to an associated worker source (usually with the same name).
 */
export class Dispatcher extends Evented<ErrorEventType> {
    workerPool: WorkerPool;
    actors: Actor[];
    private actorsPromise: Promise<Actor[]>;
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

    private async initActors(mapId: string | number): Promise<Actor[]> {
        const workers = await this.workerPool.acquire(mapId);
        if (this.removed) return [];
        const {actors, workerErrorSubscriptions} = createActors(workers, mapId, this);
        this.actors = actors;
        this.workerErrorSubscriptions = workerErrorSubscriptions;
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
