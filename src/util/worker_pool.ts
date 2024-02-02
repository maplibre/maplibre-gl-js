import {workerFactory} from './web_worker';
import {browser} from './browser';
import {isSafari} from './util';
import {ActorTarget} from './actor';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

/**
 * Constructs a worker pool.
 */
export class WorkerPool {
    static workerCount: number;

    active: {
        [_ in number | string]: boolean;
    };
    workers: Array<ActorTarget>;

    constructor() {
        this.active = {};
    }

    acquire(mapId: number | string): Array<ActorTarget> {
        if (!this.workers) {
            // Lazily look up the value of getWorkerCount so that
            // client code has had a chance to set it.
            this.workers = [];
            while (this.workers.length < WorkerPool.workerCount) {
                this.workers.push(workerFactory());
            }
        }

        this.active[mapId] = true;
        return this.workers.slice();
    }

    release(mapId: number | string) {
        delete this.active[mapId];
        if (this.numActive() === 0) {
            this.workers.forEach((w) => {
                w.terminate();
            });
            this.workers = null;
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
