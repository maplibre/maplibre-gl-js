import {workerFactory} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari} from './util.ts';
import {Evented} from './evented.ts';

import type {ActorTarget} from './actor.ts';
import type {Dispatcher} from './dispatcher.ts';
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
    /** The dispatcher whose actors live and die with the pooled workers, set once by dispatcher.ts. */
    globalDispatcher: Dispatcher | undefined;

    constructor() {
        super();
        this.active = {};
        this.workersPromise = null;
    }

    /** Claims the shared workers, creating them on the first claim. */
    async acquire(mapId: number | string): Promise<ActorTarget[]> {
        this.active[mapId] = true;
        return this.ensureWorkers();
    }

    /**
     * Returns the shared workers without claiming them, creating them on first use. The `create`
     * event fires before the workers boot, so listeners replay only state recorded before the
     * call that created them.
     */
    async ensureWorkers(): Promise<ActorTarget[]> {
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
     * Terminates the workers and discards the global dispatcher's actors, regardless of any
     * claims. The next acquire builds fresh workers.
     */
    terminate(): void {
        if (!this.workersPromise) return;
        const workersPromise = this.workersPromise;
        this.workersPromise = null;
        this.globalDispatcher?.discardActors();
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
