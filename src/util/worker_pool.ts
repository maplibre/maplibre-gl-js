import webWorkerFactory from './web_worker';
import type {WorkerInterface} from './web_worker';
import {isSafari} from './util';

export const PRELOAD_POOL_ID = 'mapboxgl_preloaded_worker_pool';

/**
 * Constructs a worker pool.
 * @private
 */
export default class WorkerPool {
    static workerCount: number;

    active: {
        [_ in number | string]: boolean;
    };
    workers: Array<WorkerInterface>;

    constructor() {
        this.active = {};
    }

    acquire(mapId: number | string): Array<WorkerInterface> {
        if (!this.workers) {
            // Lazily look up the value of mapboxgl.workerCount so that
            // client code has had a chance to set it.
            this.workers = [];
            while (this.workers.length < WorkerPool.workerCount) {
                this.workers.push(webWorkerFactory());
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
// Safari works better with cap 2-3, but almost all versions of safari don't support hardwareConcurrency
// and the fallback was worker count 2.
WorkerPool.workerCount = isSafari(globalThis) ? 2 : 1;
