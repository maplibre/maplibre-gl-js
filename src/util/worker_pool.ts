import {workerFactory} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari} from './util.ts';
import {Evented} from './evented.ts';

import type {Actor, ActorTarget} from './actor.ts';
import type {Event} from './evented.ts';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

export type WorkerPoolEventType = {
    create: Event;
};

/**
 * Constructs a worker pool.
 */
export class WorkerPool extends Evented<WorkerPoolEventType> {
    static workerCount: number;

    active: {
        [_ in number | string]: boolean;
    };
    workersPromise: Promise<ActorTarget[]> | null;
    private borrowedActorsPromise: Promise<Actor[]> | null;

    constructor() {
        super();
        this.active = {};
        this.workersPromise = null;
        this.borrowedActorsPromise = null;
    }

    /** Claims the shared workers, creating them on the first claim. */
    async acquire(mapId: number | string): Promise<ActorTarget[]> {
        this.active[mapId] = true;
        return this.ensureWorkers();
    }

    /**
     * Lends out pool-owned actors wrapping the shared workers, without claiming them, the way a
     * `WeakRef` uses an object without keeping it alive. The pool removes these actors when it
     * terminates the workers, and the next call runs `createActor` again to build fresh ones
     * around the replacement workers. Every borrower shares the one set built by the first
     * call's `createActor`.
     *
     * The promise is assigned before the workers are created, since creating them fires `create`,
     * and a listener that broadcasts borrows these actors again while they are still being built.
     */
    borrowActors(createActor: (worker: ActorTarget, index: number) => Actor): Promise<Actor[]> {
        if (!this.borrowedActorsPromise) {
            let resolveActors: (actors: Actor[]) => void;
            let rejectActors: (error: Error) => void;
            this.borrowedActorsPromise = new Promise((resolve, reject) => {
                resolveActors = resolve;
                rejectActors = reject;
            });
            this.ensureWorkers().then((workers) => resolveActors(workers.map(createActor)), rejectActors);
        }
        return this.borrowedActorsPromise;
    }

    /**
     * Returns the shared workers, creating them on first use. The `create` event fires before the
     * workers boot, so listeners replay only state recorded before the call that created them.
     */
    private async ensureWorkers(): Promise<ActorTarget[]> {
        if (!this.workersPromise) {
            const promises: Array<Promise<Worker>> = [];
            while (promises.length < WorkerPool.workerCount) {
                promises.push(workerFactory());
            }
            this.workersPromise = Promise.all(promises);
            this.fire('create');
        }
        return (await this.workersPromise).slice();
    }

    release(mapId: number | string): void {
        delete this.active[mapId];
        if (this.numActive() === 0) {
            this.terminate();
        }
    }

    /**
     * Terminates the workers and removes the borrowed actors, regardless of any claims. The next
     * acquire or borrow builds fresh workers.
     */
    terminate(): void {
        if (!this.workersPromise) return;
        const workersPromise = this.workersPromise;
        const borrowedActorsPromise = this.borrowedActorsPromise;
        this.workersPromise = null;
        this.borrowedActorsPromise = null;
        borrowedActorsPromise?.then((actors) => {
            for (const actor of actors) {
                actor.remove();
            }
        });
        workersPromise.then(workers => {
            for (const w of workers) {
                w.terminate();
            }
        });
    }

    isPreloaded(): boolean {
        return !!this.active[PRELOAD_POOL_ID];
    }

    numActive(): number {
        return Object.keys(this.active).length;
    }
}

// Based on results from A/B testing: https://github.com/maplibre/maplibre-gl-js/pull/2354
const availableLogicalProcessors = Math.floor(browser.hardwareConcurrency / 2);
WorkerPool.workerCount = isSafari(globalThis) ? Math.max(Math.min(availableLogicalProcessors, 3), 1) : 1;
