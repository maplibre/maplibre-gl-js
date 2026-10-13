import {Actor, type ActorTarget, type MessageHandler} from './actor.ts';
import {ErrorEvent, Event, Evented, type ErrorEventType} from './evented.ts';
import {type Subscription, subscribe} from './util.ts';

import type {WorkerPool} from './worker_pool.ts';
import type {MessageType, RequestResponseMessageMap} from './actor_messages.ts';

/**
 * The events that a {@link Dispatcher} fires.
 */
export type DispatcherEventType = ErrorEventType & {
    /**
     * Fired when the workers were replaced by new ones. The new workers start empty,
     * so everything that was sent to the previous workers should be sent again.
     */
    workersrestart: Event;
};

/**
 * Responsible for sending messages from a {@link Source} to an associated worker source (usually with the same name).
 */
export class Dispatcher extends Evented<DispatcherEventType> {
    workerPool: WorkerPool;
    actors: Actor[];
    actorsPromise: Promise<Actor[]>;
    currentActor: number;
    id: string | number;
    private removed: boolean;
    private workerErrorSubscriptions: Subscription[];
    /** The registered handlers, kept so that they can be registered again on the actors of new workers. */
    private messageHandlers: {[K in MessageType]?: MessageHandler<K>};
    /** Counts the times the actors were created, to tell when a creation was overtaken by a newer one. */
    private initCount: number;
    private restartSubscription: Subscription;

    constructor(workerPool: WorkerPool, mapId: string | number) {
        super();
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        this.removed = false;
        this.workerErrorSubscriptions = [];
        this.messageHandlers = {};
        this.initCount = 0;
        this.restartSubscription = workerPool.on('restart', this.onWorkersRestarted);
        this.actorsPromise = this.initActors();
    }

    private async initActors(): Promise<Actor[]> {
        const initCount = ++this.initCount;
        const workers = await this.workerPool.acquire(this.id);
        if (this.removed) return [];
        if (initCount !== this.initCount) return this.actorsPromise;
        this.actors = workers.map((worker: ActorTarget, i: number) => {
            this.workerErrorSubscriptions.push(subscribe(worker, 'error', () => {
                this.fire(new ErrorEvent(new Error('Worker failed to load. Check that the worker URL is correct.')));
            }, false));
            const actor = new Actor(worker, this.id);
            actor.name = `Worker ${i}`;
            for (const type in this.messageHandlers) {
                actor.registerMessageHandler(type as MessageType, this.messageHandlers[type]);
            }
            return actor;
        });
        if (!this.actors.length) throw new Error('No actors found');
        return this.actors;
    }

    /**
     * Replaces the actors with actors of the new workers, when the worker pool replaced the workers,
     * and fires the `workersrestart` event.
     */
    private onWorkersRestarted = (): void => {
        if (this.removed) return;
        this.removeActors();
        this.actorsPromise = this.initActors();
        this.fire(new Event('workersrestart'));
    };

    private removeActors(): void {
        for (const actor of this.actors) {
            actor.remove();
        }
        for (const subscription of this.workerErrorSubscriptions) {
            subscription.unsubscribe();
        }
        this.actors = [];
        this.workerErrorSubscriptions = [];
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
        this.restartSubscription.unsubscribe();
        this.removeActors();
        this.setEventedParent(null);
        if (mapRemoved) this.workerPool.release(this.id);
    }

    public async registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void> {
        (this.messageHandlers as Record<T, MessageHandler<T>>)[type] = handler;
        const actors = await this.actorsPromise;
        for (const actor of actors) {
            actor.registerMessageHandler(type, handler);
        }
    }

    public async unregisterMessageHandler<T extends MessageType>(type: T): Promise<void> {
        delete this.messageHandlers[type];
        const actors = await this.actorsPromise;
        for (const actor of actors) {
            actor.unregisterMessageHandler(type);
        }
    }
}
