import {type AddProtocolAction, config} from './config.ts';
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

function defaultWorkerUrl(): string {
    const moduleUrl = import.meta.url;
    if (!/^https?:/.test(moduleUrl)) return '';
    const workerName = moduleUrl.endsWith('-dev.mjs')
        ? 'maplibre-gl-worker-dev.mjs'
        : 'maplibre-gl-worker.mjs';
    return new URL(`./${workerName}`, moduleUrl).href;
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

export type WorkerErrorHandler = (error: Error) => void;

const WORKER_MIGRATION_GUIDE = 'https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/';

function resolveWorkerUrl(url: string): string {
    try {
        return new URL(url, globalThis.location?.href || import.meta.url).href;
    } catch {
        // WORKER_URL is user-configurable. Preserve malformed values for the
        // diagnostic instead of throwing while handling the worker failure.
        return url;
    }
}

function monitorWorker(worker: Worker, url: string, onError: WorkerErrorHandler): void {
    let receivedMessage = false;
    worker.addEventListener('message', () => {
        receivedMessage = true;
    }, {once: true});

    worker.addEventListener('error', (event) => {
        const resolvedUrl = resolveWorkerUrl(url);
        const details = event.message ? ` (${event.message})` : '';
        if (!receivedMessage) {
            onError(new Error(
                `Failed to load the MapLibre worker script: ${resolvedUrl}${details}\n` +
                `If you use a bundler, set the worker URL explicitly; see ${WORKER_MIGRATION_GUIDE}`
            ));
        } else {
            onError(new Error(`The MapLibre worker script failed while running: ${resolvedUrl}${details}`));
        }
    }, {once: true});

    worker.addEventListener('messageerror', () => {
        onError(new Error(`Failed to communicate with the MapLibre worker script: ${resolveWorkerUrl(url)}`));
    }, {once: true});
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

function importAsBlobUrl(url: string): string {
    const blob = new Blob([`import ${JSON.stringify(new URL(url, import.meta.url).href)}`], {type: 'text/javascript'});
    return URL.createObjectURL(blob);
}

export async function workerFactory(onError: WorkerErrorHandler): Promise<Worker> {
    const url = config.WORKER_URL || defaultWorkerUrl();
    const asModule = url?.endsWith('.cjs') ? false : true;

    if (!isCrossOrigin(url)) {
        const worker = createWorker(url, asModule);
        monitorWorker(worker, url, onError);
        return worker;
    }

    if (asModule) {
        const blobUrl = importAsBlobUrl(url);
        try {
            const worker = createWorker(blobUrl, asModule);
            monitorWorker(worker, url, onError);
            return worker;
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    const blobUrl = await fetchAsBlobUrl(url);
    try {
        const worker = createWorker(blobUrl, asModule);
        monitorWorker(worker, url, onError);
        return worker;
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}
