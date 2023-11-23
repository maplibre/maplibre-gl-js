import {config} from './config';
import type {default as MaplibreWorker} from '../source/worker';
import type {WorkerSourceConstructor} from '../source/worker_source';

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (sourceName: string, sourceConstrucor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    worker: MaplibreWorker;
}

export function workerFactory() {
    return new Worker(config.WORKER_URL);
}
