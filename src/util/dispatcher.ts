import {Actor, type ActorTarget, type MessageHandler} from './actor.ts';
import {ErrorEvent, Evented, type ErrorEventType} from './evented.ts';
import {type Subscription, subscribe} from './util.ts';

import type {WorkerPool} from './worker_pool.ts';
import type {MessageType, RequestResponseMessageMap} from './actor_messages.ts';

/**
 * Responsible for sending messages from a {@link Source} to an associated worker source (usually with the same name).
 */
export class Dispatcher extends Evented<ErrorEventType> {
    workerPool: Pick<WorkerPool, 'acquire' | 'release'>;
    actors: Actor[];
    private actorsPromise: Promise<Actor[]> | undefined;
    currentActor: number;
    id: string | number;
    private messageHandlers: Record<string, MessageHandler<MessageType>>;
    private removed: boolean;
    private workerErrorSubscriptions: Subscription[];

    constructor(workerPool: Pick<WorkerPool, 'acquire' | 'release'>, mapId: string | number) {
        super();
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        this.messageHandlers = {};
        this.removed = false;
        this.workerErrorSubscriptions = [];
    }

    private async initActors(): Promise<Actor[]> {
        const workers = await this.workerPool.acquire(this.id);
        if (this.removed) return [];
        this.actors = workers.map((worker: ActorTarget, i: number) => {
            this.workerErrorSubscriptions.push(subscribe(worker, 'error', () => {
                this.fire(new ErrorEvent(new Error('Worker failed to load. Check that the worker URL is correct.')));
            }, false));
            const actor = new Actor(worker, this.id);
            actor.name = `Worker ${i}`;
            for (const [type, handler] of Object.entries(this.messageHandlers)) {
                actor.registerMessageHandler(type as MessageType, handler);
            }
            return actor;
        });
        if (!this.actors.length) throw new Error('No actors found');
        return this.actors;
    }

    discardActors(): void {
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
     * Returns the actors, creating them on first use. The promise is stored before `initActors`
     * runs, because creating the workers re-enters this method through the pool's `create` event.
     */
    getActors(): Promise<Actor[]> {
        if (this.removed) return Promise.resolve([]);
        if (!this.actorsPromise) {
            let resolveActors: (actors: Actor[]) => void;
            let rejectActors: (error: Error) => void;
            this.actorsPromise = new Promise((resolve, reject) => {
                resolveActors = resolve;
                rejectActors = reject;
            });
            this.initActors().then(resolveActors, rejectActors);
        }
        return this.actorsPromise;
    }

    /**
     * Broadcast a message to all Workers.
     * The type can be any string, to allow sending messages that are handled by a script that was imported using {@link importScriptInWorkers}.
     */
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<Array<RequestResponseMessageMap[T][1]>>;
    broadcast<TData = any, TResult = any>(type: string, data: TData): Promise<TResult[]>;
    async broadcast(type: string, data: unknown): Promise<unknown[]> {
        const actors = await this.getActors();
        return Promise.all(actors.map(actor => actor.sendAsync({type: type as MessageType, data: data as any})));
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
        await this.getActors();
    }

    getReadyActor(): Actor {
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }

    remove(mapRemoved: boolean = true): void {
        this.removed = true;
        this.discardActors();
        this.setEventedParent(null);
        if (mapRemoved) this.workerPool.release(this.id);
    }

    /**
     * Registers a handler for messages that the workers send to this dispatcher.
     * The type can be any string, to allow handling messages that are sent by a script that was imported using {@link importScriptInWorkers}.
     */
    public registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): Promise<void>;
    public registerMessageHandler<TData = any, TResult = any>(type: string, handler: CustomMessageHandler<TData, TResult>): Promise<void>;
    public async registerMessageHandler(type: string, handler: CustomMessageHandler<any, any>): Promise<void> {
        this.messageHandlers[type] = handler;
        for (const actor of this.actors) {
            actor.registerMessageHandler(type as MessageType, handler);
        }
    }

    public async unregisterMessageHandler(type: MessageType | string): Promise<void> {
        delete this.messageHandlers[type];
        for (const actor of this.actors) {
            actor.unregisterMessageHandler(type as MessageType);
        }
    }
}

/**
 * A handler for a message that is not one of the built-in {@link MessageType}s, e.g. a message that is sent by a plugin.
 */
export type CustomMessageHandler<TData, TResult> = (mapId: string | number, params: TData, abortController?: AbortController) => Promise<TResult>;
