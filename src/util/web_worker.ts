import {type AddProtocolAction, config} from './config.ts';
import {type ActorTarget} from './actor.ts';
import type {default as MaplibreWorker} from '../source/worker.ts';
import type {WorkerSourceConstructor} from '../source/worker_source.ts';
import type {GetResourceResponse, RequestParameters} from './ajax.ts';

export interface WorkerGlobalScopeInterface {
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    makeRequest: (request: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>>;
    worker: MaplibreWorker;
}

function isCrossOrigin(url: string): boolean {
    if (!url) return false;
    const loc = (globalThis as any).location;
    if (!loc) return false;
    try {
        return new URL(url, loc.href).origin !== loc.origin;
    } catch {
        return false;
    }
}

function createWorker(url: string, asModule: boolean): Worker {
    if (asModule) {
        try {
            return new Worker(url, {type: 'module'});
        } catch (e) {
            console.warn('Module worker not supported, falling back to classic worker', e);
        }
    }
    return new Worker(url);
}

async function fetchAsBlobUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch worker script (${response.status}): ${url}`);
    }
    const code = await response.text();
    const blob = new Blob([code], {type: 'text/javascript'});
    return URL.createObjectURL(blob);
}

class DeferredWorker implements ActorTarget {
    private worker: Worker | null = null;
    private terminated = false;
    private pendingMessages: Array<{message: any; options?: any}> = [];
    private pendingListeners: Array<{type: string; listener: any; options?: any}> = [];

    constructor(workerPromise: Promise<Worker>) {
        workerPromise.then(worker => {
            if (this.terminated) {
                worker.terminate();
                return;
            }
            this.worker = worker;
            for (const {type, listener, options} of this.pendingListeners) {
                worker.addEventListener(type, listener, options);
            }
            this.pendingListeners = [];
            for (const {message, options} of this.pendingMessages) {
                worker.postMessage(message, options);
            }
            this.pendingMessages = [];
        }).catch(err => {
            console.error('Failed to load worker script', err);
        });
    }

    postMessage(message: any, options?: any): void {
        if (this.worker) {
            this.worker.postMessage(message, options);
        } else if (!this.terminated) {
            this.pendingMessages.push({message, options});
        }
    }

    addEventListener(type: string, listener: any, options?: any): void {
        if (this.worker) {
            this.worker.addEventListener(type, listener, options);
        } else {
            this.pendingListeners.push({type, listener, options});
        }
    }

    removeEventListener(type: string, listener: any, options?: any): void {
        if (this.worker) {
            this.worker.removeEventListener(type, listener, options);
        } else {
            this.pendingListeners = this.pendingListeners.filter(
                l => !(l.type === type && l.listener === listener)
            );
        }
    }

    terminate(): void {
        this.terminated = true;
        this.pendingMessages = [];
        this.pendingListeners = [];
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export function workerFactory(): ActorTarget {
    const url = config.WORKER_URL;
    const asModule = url?.endsWith('.mjs') ?? false;

    if (!isCrossOrigin(url)) {
        return createWorker(url, asModule);
    }

    const workerPromise = fetchAsBlobUrl(url).then(blobUrl => {
        const worker = createWorker(blobUrl, asModule);
        URL.revokeObjectURL(blobUrl);
        return worker;
    });

    return new DeferredWorker(workerPromise);
}
