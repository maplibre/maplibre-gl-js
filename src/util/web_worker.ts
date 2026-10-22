import packageJSON from '../../package.json' with {type: 'json'};
import {type AddProtocolAction, config} from './config.ts';

import type {default as MaplibreWorker} from '../source/worker.ts';
import type {WorkerSourceConstructor} from '../source/worker_source.ts';
import type {GetResourceResponse, RequestParameters} from './ajax.ts';
import type {ProjectionHandler} from '../source/projection_handler_worker.ts';

export interface WorkerGlobalScopeInterface {
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    makeRequest: (request: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>>;
    /**
     * @experimental
     * Sets the workers' `ProjectionHandler`, for GeoJSON sources on a map in a registered projection; `null` removes it.
     */
    setProjectionHandler: (handler: ProjectionHandler | null) => void;
    worker: MaplibreWorker;
}

function isCrossOrigin(url: string): boolean {
    if (!url) return false;
    const loc = (globalThis as any).location;
    if (!loc) return false;
    // Inside a `srcdoc` iframe `location.origin` is the string "null", because the
    // document has no location of its own, while its real origin is inherited from
    // the parent and exposed as `globalThis.origin`. Comparing against "null" marked
    // every same-origin worker URL as cross-origin (#8850).
    const origin = (globalThis as any).origin || loc.origin;
    try {
        return new URL(url, loc.href).origin !== origin;
    } catch {
        return false;
    }
}

/**
 * Release a Blob URL once the worker has actually read it.
 *
 * `new Worker(blobUrl)` returns before the browser has fetched the script, so
 * revoking immediately races worker startup and fails the load outright on
 * slower engines (#8854). Module workers have no "loaded" event; the first
 * `message` — or `error` — is the earliest point at which the script is known
 * to have been evaluated, and is when the URL is no longer needed.
 */
function releaseBlobUrlWhenLoaded(worker: Worker, blobUrl: string): void {
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        worker.removeEventListener('message', release);
        worker.removeEventListener('error', release);
        URL.revokeObjectURL(blobUrl);
    };
    worker.addEventListener('message', release);
    worker.addEventListener('error', release);
}

/**
 * The URL of the worker bundle next to this module, carrying the package version as a `v` query
 * parameter so that a browser does not serve a worker cached from an older release.
 */
function defaultWorkerUrl(): string {
    const moduleUrl = import.meta.url;
    if (!/^https?:/.test(moduleUrl)) return '';
    const workerName = moduleUrl.endsWith('-dev.mjs')
        ? 'maplibre-gl-worker-dev.mjs'
        : 'maplibre-gl-worker.mjs';
    const url = new URL(`./${workerName}`, moduleUrl);
    url.searchParams.set('v', packageJSON.version);
    return url.href;
}

function isClassicWorkerUrl(url: string): boolean {
    return url.endsWith('.cjs') || url.split(/[?#]/)[0].endsWith('.cjs');
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

function importAsBlobUrl(url: string): string {
    const blob = new Blob([`import ${JSON.stringify(new URL(url, import.meta.url).href)}`], {type: 'text/javascript'});
    return URL.createObjectURL(blob);
}

export async function workerFactory(): Promise<Worker> {
    const url = config.WORKER_URL || defaultWorkerUrl();
    const asModule = !isClassicWorkerUrl(url);

    if (!isCrossOrigin(url)) {
        return createWorker(url, asModule);
    }

    if (asModule) {
        const blobUrl = importAsBlobUrl(url);
        try {
            const worker = createWorker(blobUrl, asModule);
            releaseBlobUrlWhenLoaded(worker, blobUrl);
            return worker;
        } catch (e) {
            URL.revokeObjectURL(blobUrl);
            throw e;
        }
    }

    const blobUrl = await fetchAsBlobUrl(url);
    try {
        const worker = createWorker(blobUrl, asModule);
        releaseBlobUrlWhenLoaded(worker, blobUrl);
        return worker;
    } catch (e) {
        URL.revokeObjectURL(blobUrl);
        throw e;
    }
}
