import mapboxgl from '../';
import type {WorkerSource} from '../source/worker_source';

type MessageListener = (
    a: {
        data: any,
        target: any
    }
) => unknown;
export interface WorkerInterface {
    addEventListener(type: "message", listener: MessageListener): void;
    removeEventListener(type: "message", listener: MessageListener): void;
    postMessage(message: any): void;
    terminate(): void;
}

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (
        name: string,
        WorkerSource: {
            new(...args: any): WorkerSource
        }
    ) => void;
    registerRTLTextPlugin: (_: any) => void;
}

export default function (): WorkerInterface {
    return new Worker(mapboxgl.workerUrl) as any;
}
