import {type AddProtocolAction, config} from './config';
import type {default as MaplibreWorker} from '../source/worker';
import type {WorkerSourceConstructor} from '../source/worker_source';
import type {GetResourceResponse, RequestParameters} from './ajax';

export interface WorkerGlobalScopeInterface {
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    makeRequest: (request: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>>;
    worker: MaplibreWorker;
}

export function workerFactory() {
    if (config.WORKER_URL?.endsWith('.mjs')) {
        try {
            return new Worker(config.WORKER_URL, {type: 'module'});
        } catch (e) {
            console.warn('Module worker not supported, falling back to classic worker', e);
        }
    }
    return new Worker(config.WORKER_URL);
}
