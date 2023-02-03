import webWorkerFactory from './web_worker';
import type {WorkerInterface} from './web_worker';
import browser from './browser';

export const PRELOAD_POOL_ID = 'maplibregl_preloaded_worker_pool';

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
            // Lazily look up the value of maplibregl.workerCount so that
            // client code has had a chance to set it.
            this.workers = webWorkerFactory();

            // Sync worker count with number of workers in case user provide
            // there own workers.
            WorkerPool.workerCount = this.workers.length;
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

const availableLogicalProcessors = Math.floor(browser.hardwareConcurrency / 2);
WorkerPool.workerCount = Math.max(Math.min(availableLogicalProcessors, 6), 1);
