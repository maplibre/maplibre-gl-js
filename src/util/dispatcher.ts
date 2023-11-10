import {asyncAll} from './util';
import {Actor, GlyphsProvider, MessageType} from './actor';

import type {WorkerPool} from './worker_pool';
import type {WorkerSource} from '../source/worker_source'; /* eslint-disable-line */ // this is used for the docs' import
/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 */
export class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: string | number;

    constructor(workerPool: WorkerPool, parent: GlyphsProvider, mapId: string | number) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        const workers = this.workerPool.acquire(mapId);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Actor(worker, parent, mapId);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
        if (!this.actors.length) throw new Error('No actors found');
    }

    /**
     * Broadcast a message to all Workers.
     */
    broadcast(type: MessageType, data: unknown, cb?: (...args: any[]) => any) {
        cb = cb || function () {};
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
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
}
