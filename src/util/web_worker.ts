import {config} from './config';

import type {WorkerSource} from '../source/worker_source';

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (
        b: string,
        a: {
            new(...args: any): WorkerSource;
        }
    ) => void;
    registerRTLTextPlugin: (_: any) => void;
}

export function workerFactory() {
    return new Worker(config.WORKER_URL);
}
