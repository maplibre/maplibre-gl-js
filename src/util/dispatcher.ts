import {Actor} from './actor';

import type {WorkerPool} from './worker_pool';
import type {WorkerSource} from '../source/worker_source'; /* eslint-disable-line */ // this is used for the docs' import
import type {MessageType, RequestObjectMap, ResponseObjectMap} from './actor_messages';
/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 */
export class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: string | number;

    constructor(workerPool: WorkerPool, handlers: { getImages: Function; getGlyphs: Function; getResource: Function}, mapId: string | number) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        const workers = this.workerPool.acquire(mapId);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Actor(worker, mapId);
            actor.name = `Worker ${i}`;
            // HM TODO: use promises in the following methods or move the registration to a different method
            actor.registerMessageHandler('getGlyphs', (mapId, params) => {
                return new Promise((resolve, reject) => {
                    handlers.getGlyphs(mapId, params, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });
            });
            actor.registerMessageHandler('getImages', (mapId, params) => {
                return new Promise((resolve, reject) => {
                    handlers.getImages(mapId, params, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });
            });
            actor.registerMessageHandler('getResource', (mapId, params) => {
                return new Promise((resolve, reject) => {
                    handlers.getImages(mapId, params, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });
            });
            this.actors.push(actor);
        }
        if (!this.actors.length) throw new Error('No actors found');
    }

    /**
     * Broadcast a message to all Workers.
     */
    broadcast<T extends MessageType>(type: T, data: RequestObjectMap[T]): Promise<ResponseObjectMap[T][]> {
        const promises: Promise<ResponseObjectMap[T]>[] = [];
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
}
