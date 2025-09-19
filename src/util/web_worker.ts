import {type AddProtocolAction, config} from './config';
import type {default as MaplibreWorker} from '../source/worker';
import type {WorkerSourceConstructor} from '../source/worker_source';

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    worker: MaplibreWorker;
}

export function workerFactory() {
    // Check if we should use module workers (for ESM builds)
    const useModuleWorker = config.WORKER_URL && config.WORKER_URL.endsWith('.mjs');
    
    if (useModuleWorker) {
        try {
            return new Worker(config.WORKER_URL, {type: 'module'});
        } catch (e) {
            // Fallback to regular worker if module workers not supported
            console.warn('Module worker not supported, falling back to classic worker', e);
        }
    }
    
    return new Worker(config.WORKER_URL);
}
