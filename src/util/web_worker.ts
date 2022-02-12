import maplibregl from '../index';

import type {WorkerSource} from '../source/worker_source';

export type MessageListener = (
    a: {
        data: any;
        target: any;
    }
) => unknown;

// The main thread interface. Provided by Worker in a browser environment,
export interface WorkerInterface {
    addEventListener(type: 'message', listener: MessageListener): void;
    removeEventListener(type: 'message', listener: MessageListener): void;
    postMessage(message: any): void;
    terminate(): void;
}

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

export default function workerFactory() {
    return new Worker(maplibregl.workerUrl);
}
