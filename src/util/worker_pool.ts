import {workerFactory} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari, warnOnce} from './util.ts';
import {Evented, type Event} from './evented.ts';

import type {ActorTarget} from './actor.ts';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

export type WorkerPoolEventType = {
    create: Event;
    terminate: Event;
};

/**
 * Constructs a worker pool.
 */
export class WorkerPool extends Evented<WorkerPoolEventType> {
    static workerCount: number;

    active: {
        [_ in number | string]: boolean;
    };
    private workersPromise: Promise<ActorTarget[]> | null;

    constructor() {
        super();
        this.active = {};
        this.workersPromise = null;
    }

    /** Claims the shared workers, creating them on the first claim. */
    acquire(mapId: number | string): Promise<ActorTarget[]> {
        this.active[mapId] = true;
        return this.start();
    }

    /**
     * Starts the shared workers if they are not running and returns them, without claiming them.
     * The `terminate` event still fires once the last claim is released.
     */
    async start(): Promise<ActorTarget[]> {
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

    /**
     * Terminates the shared workers and creates replacements, keeping every claim. For workers
     * the browser killed behind the library's back. The `terminate` and `create` events let
     * everything holding actors on the old workers rebuild them on the new ones.
     */
    restart(): void {
        if (!this.workersPromise) return;
        this.terminate();
        (async () => {
            try {
                await this.start();
            } catch (error) {
                warnOnce(`Failed to create replacement workers: ${error}`);
            }
        })();
    }

    release(mapId: number | string): void {
        delete this.active[mapId];
        if (this.numActive() === 0) {
            this.terminate();
        }
    }

    /** Drops the current workers, firing `terminate`, and terminates each one once it exists. */
    private terminate(): void {
        const promise = this.workersPromise;
        if (!promise) return;
        this.workersPromise = null;
        this.fire('terminate');
        (async () => {
            try {
                for (const w of await promise) {
                    w.terminate();
                }
            } catch (error) {
                warnOnce(`The terminated workers were never created: ${error}`);
            }
        })();
    }

    isStarted(): boolean {
        return !!this.workersPromise;
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
