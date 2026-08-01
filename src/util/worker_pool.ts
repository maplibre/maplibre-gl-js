import {workerFactory, type WorkerErrorHandler} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari} from './util.ts';
import {type ActorTarget} from './actor.ts';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

/**
 * Constructs a worker pool.
 */
export class WorkerPool {
    static workerCount: number;

    active: {
        [_ in number | string]: WorkerErrorHandler | null;
    };
    workersPromise: Promise<ActorTarget[]> | null;
    private workerError: Error | null;
    private workerGeneration: number;

    constructor() {
        this.active = {};
        this.workersPromise = null;
        this.workerError = null;
        this.workerGeneration = 0;
    }

    async acquire(mapId: number | string, onError?: WorkerErrorHandler): Promise<ActorTarget[]> {
        this.active[mapId] = onError || null;
        if (this.workerError && onError) {
            const workerError = this.workerError;
            Promise.resolve().then(() => {
                if (this.active[mapId] === onError) onError(workerError);
            });
        }
        if (!this.workersPromise) {
            const workerGeneration = ++this.workerGeneration;
            const promises: Array<Promise<Worker>> = [];
            while (promises.length < WorkerPool.workerCount) {
                promises.push(workerFactory((error) => {
                    if (workerGeneration === this.workerGeneration) this.onWorkerError(error);
                }));
            }
            this.workersPromise = Promise.all(promises);
        }
        return (await this.workersPromise).slice();
    }

    private onWorkerError(error: Error): void {
        if (this.workerError) return;
        this.workerError = error;
        for (const [mapId, onError] of Object.entries(this.active)) {
            if (!onError) continue;
            Promise.resolve().then(() => {
                if (this.active[mapId] === onError) onError(error);
            });
        }
    }

    release(mapId: number | string): void {
        delete this.active[mapId];
        if (this.numActive() === 0 && this.workersPromise) {
            const promise = this.workersPromise;
            this.workersPromise = null;
            this.workerError = null;
            this.workerGeneration++;
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
