import {workerFactory} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari} from './util.ts';

import type {ActorTarget} from './actor.ts';
import type {Subscription} from './util.ts';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

/**
 * Constructs a worker pool.
 */
export class WorkerPool {
    static workerCount: number;

    active: {
        [_ in number | string]: boolean;
    };
    workersPromise: Promise<ActorTarget[]> | null;
    private onCreateListeners: Array<() => void>;
    private onTerminateListeners: Array<() => void>;

    constructor() {
        this.active = {};
        this.workersPromise = null;
        this.onCreateListeners = [];
        this.onTerminateListeners = [];
    }

    onCreate(listener: () => void): Subscription {
        this.onCreateListeners.push(listener);
        return {
            unsubscribe: () => {
                const index = this.onCreateListeners.indexOf(listener);
                if (index !== -1) this.onCreateListeners.splice(index, 1);
            }
        };
    }

    /** Claims the shared workers, creating them on the first claim. */
    async acquire(mapId: number | string): Promise<ActorTarget[]> {
        this.active[mapId] = true;
        return this.ensureWorkers();
    }

    /**
     * Uses the shared workers without claiming them, the way a `WeakRef` holds an object without keeping it alive.
     * `onTerminate` fires once the last claim is released, since the workers are dead from then on.
     */
    async weakAcquire(onTerminate: () => void): Promise<ActorTarget[]> {
        this.onTerminateListeners.push(onTerminate);
        return this.ensureWorkers();
    }

    private async ensureWorkers(): Promise<ActorTarget[]> {
        if (this.workersPromise) return (await this.workersPromise).slice();

        const promises: Array<Promise<Worker>> = [];
        while (promises.length < WorkerPool.workerCount) {
            promises.push(workerFactory());
        }
        this.workersPromise = Promise.all(promises);
        for (const onCreate of this.onCreateListeners.slice()) {
            onCreate();
        }
        return (await this.workersPromise).slice();
    }

    release(mapId: number | string): void {
        delete this.active[mapId];
        if (this.numActive() === 0 && this.workersPromise) {
            const promise = this.workersPromise;
            this.workersPromise = null;
            for (const onTerminate of this.onTerminateListeners.splice(0)) {
                onTerminate();
            }
            promise.then(workers => {
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
