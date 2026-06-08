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

function importWorker() {
    // Bundlers resolve this import to the final output filename.
    // defaultWorkerUrl() extracts the resolved path via toString().
    import('../source/worker.ts');
}

// This is a hack to signal to bundlers that this module is async (has top-level await)
// in order to prevent the shared module from being inlined into main.
//
// Rollup/rolldown by default inlines the shared module into the main bundle
// if the app has only one entry point.
// The worker would then import the shared module from the main bundle,
// which fails because main uses APIs that are not available in workers.
//
// To work around this, we make main async with a no-op `await import()` at the top level.
// Bundler deadlock guard would prevent the shared module from being inlined into main.
try {
    let src: string;
    await import(src);
} catch {}

function defaultWorkerUrl(): string {
    try {
        const moduleUrl = import.meta.url;
        if (!/^https?:/.test(moduleUrl)) return '';
        const workerPath = importWorker.toString().match(/["'`](.+?)["'`]/)?.[1];
        if (workerPath) {
            return new URL(workerPath, moduleUrl).href;
        }
    } catch {
        // fall through
    }
    try {
        const moduleUrl = import.meta.url;
        if (!/^https?:/.test(moduleUrl)) return '';
        const workerName = moduleUrl.endsWith('-dev.mjs')
            ? 'maplibre-gl-worker-dev.mjs'
            : 'maplibre-gl-worker.mjs';
        return new URL(`./${workerName}`, moduleUrl).href;
    } catch {
        return '';
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

export async function workerFactory(): Promise<Worker> {
    const url = config.WORKER_URL || defaultWorkerUrl();
    const asModule = url?.endsWith('.cjs') ? false : true;

    if (!isCrossOrigin(url)) {
        return createWorker(url, asModule);
    }

    const blobUrl = await fetchAsBlobUrl(url);
    try {
        return createWorker(blobUrl, asModule);
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}
