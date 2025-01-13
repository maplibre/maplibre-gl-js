import {type AddProtocolAction, config} from './config';
import {type FeaturePropertiesTransform} from '../source/feature_properties_transform';
import type {default as MaplibreWorker} from '../source/worker';
import type {WorkerSourceConstructor} from '../source/worker_source';

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    setFeaturePropertiesTransform: (transform: FeaturePropertiesTransform | null) => void;
    worker: MaplibreWorker;
}

export function workerFactory() {
    return new Worker(config.WORKER_URL);
}
