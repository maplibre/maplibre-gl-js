import {workerFactory} from './web_worker.ts';
import {browser} from './browser.ts';
import {isSafari, warnOnce} from './util.ts';
import {Evented, type Event} from './evented.ts';

import type {ActorTarget} from './actor.ts';

export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';

export type WorkerPoolEventType = {
    /** Fires once a new set of workers exists, unless they were terminated while being created. */
    create: Event;
    /** Fires when the workers are dropped, before they are terminated. */
    terminate: Event;
    /** Fires after {@link WorkerPool.restart} replaces the workers, whose state the old ones took with them. */
    restart: Event;
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
        if (this.workersPromise) return (await this.workersPromise).slice();

        const promises: Array<Promise<Worker>> = [];
        while (promises.length < WorkerPool.workerCount) {
            promises.push(workerFactory());
        }
        const workersPromise = this.workersPromise = Promise.all(promises);
        const workers = await workersPromise;
        if (this.workersPromise === workersPromise) this.fire('create');
        return workers.slice();
    }

    /**
     * Terminates the shared workers and creates replacements, keeping every claim. For workers
     * the browser killed behind the library's back. Fires `restart` once the replacements exist,
     * so whatever held state in the old workers can send it again.
     */
    async restart(): Promise<void> {
        if (!this.workersPromise) return;
        this.terminate();
        try {
            await this.start();
        } catch (error) {
            warnOnce(`Failed to create replacement workers: ${error}`);
            return;
        }
        this.fire('restart');
    }

    /** Releases a claim, terminating the workers once no claim is left. Resolves once they are terminated. */
    async release(mapId: number | string): Promise<void> {
        delete this.active[mapId];
        if (this.numActive() === 0) {
            await this.terminate();
        }
    }

    /**
     * Drops the current workers and fires `terminate` before returning to the caller, so nothing
     * can reach them afterwards. Resolves once each one, still being created or not, is terminated.
     */
    private async terminate(): Promise<void> {
        const promise = this.workersPromise;
        if (!promise) return;
        this.workersPromise = null;
        this.fire('terminate');
        try {
            for (const w of await promise) {
                w.terminate();
            }
        } catch (error) {
            warnOnce(`The terminated workers were never created: ${error}`);
        }
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
