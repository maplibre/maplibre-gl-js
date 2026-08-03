import {type AddProtocolAction, config} from './config.ts';
import type {default as MaplibreWorker} from '../source/worker.ts';
import type {WorkerSourceConstructor} from '../source/worker_source.ts';
import type {GetResourceResponse, RequestParameters} from './ajax.ts';
import type {ActorTarget} from './actor.ts';

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

/**
 * Calls `onLoadError` if the worker errors before it has produced a single
 * message, which is the signature of its script failing to load (wrong URL,
 * 404, blocked import). Runtime errors of a healthy worker are left alone.
 */
export function watchWorkerStartup(worker: ActorTarget, onLoadError: (error: Error) => void): void {
    if (!worker.addEventListener || !worker.removeEventListener) return;
    let alive = false;
    const onMessage = () => {
        alive = true;
        // Deferred: removing listeners while an event is being dispatched is
        // safe on real EventTargets but not on all worker stand-ins.
        queueMicrotask(cleanup);
    };
    const onError = (e: ErrorEvent) => {
        if (alive) return;
        cleanup();
        onLoadError(new Error(
            `The map's worker script failed to load${e?.message ? ` (${e.message})` : ''}. ` +
            'Sources that depend on the worker (vector tiles, GeoJSON) cannot be processed and the map may never fire "load". ' +
            'When bundling or self-hosting, point setWorkerUrl() at a reachable copy of the worker bundle; ' +
            'see the v5-to-v6 migration guide.'));
    };
    const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
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

export async function workerFactory(): Promise<Worker> {
    const url = config.WORKER_URL || defaultWorkerUrl();
    const asModule = url?.endsWith('.cjs') ? false : true;

    if (!isCrossOrigin(url)) {
        const worker = createWorker(url, asModule);
        watchWorkerStartup(worker, (error) => console.error(`MapLibre: ${error.message}`, 'Worker URL:', url));
        return worker;
    }

    if (asModule) {
        const blobUrl = importAsBlobUrl(url);
        try {
            const worker = createWorker(blobUrl, asModule);
            watchWorkerStartup(worker, (error) => console.error(`MapLibre: ${error.message}`, 'Worker URL:', url));
            return worker;
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    const blobUrl = await fetchAsBlobUrl(url);
    try {
        const worker = createWorker(blobUrl, asModule);
        watchWorkerStartup(worker, (error) => console.error(`MapLibre: ${error.message}`, 'Worker URL:', url));
        return worker;
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}
