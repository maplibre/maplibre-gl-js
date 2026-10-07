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
    private weakActorsPromise: Promise<Actor[]> | null;

    constructor() {
        super();
        this.active = {};
        this.workersPromise = null;
        this.weakActorsPromise = null;
    }

    /** Claims the shared workers, creating them on the first claim. */
    async acquire(mapId: number | string): Promise<ActorTarget[]> {
        this.active[mapId] = true;
        return this.ensureWorkers();
    }

    /**
     * Returns pool-owned actors wrapping the shared workers, without claiming them, the way a
     * `WeakRef` holds an object without keeping it alive. The pool removes these actors when it
     * terminates the workers, and the next call runs `createActor` again to build fresh ones
     * around the replacement workers.
     */
    weakAcquire(createActor: (worker: ActorTarget, index: number) => Actor): Promise<Actor[]> {
        this.weakActorsPromise ||= this.ensureWorkers().then((workers) => workers.map(createActor));
        return this.weakActorsPromise;
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
        if (this.numActive() === 0 && this.workersPromise) {
            const workersPromise = this.workersPromise;
            const weakActorsPromise = this.weakActorsPromise;
            this.workersPromise = null;
            this.weakActorsPromise = null;
            weakActorsPromise?.then((actors) => {
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
