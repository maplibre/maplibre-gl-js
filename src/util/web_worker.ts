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
    try {
        return new URL(url, loc.href).origin !== loc.origin;
    } catch {
        return false;
    }
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

/**
 * Whether the page has an opaque origin, as a page opened from a file or in a sandboxed iframe does.
 */
function hasOpaqueOrigin(): boolean {
    return globalThis.origin === 'null';
}

/**
 * Returns the module at the Blob URL `url` as a `data:` URL. On a page opened from a file, Chrome and Safari
 * don't let a worker import the page's `blob:` URLs, while the page itself can read them.
 */
async function fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(await response.text())}`;
}

/**
 * A classic worker script that imports the module worker whose URL it receives as its first message, and holds
 * back later messages until that module has loaded, or closes if it fails to. On a page with an opaque origin,
 * Chrome starts a classic worker from a `blob:` URL, but not a module worker.
 */
const CLASSIC_WORKER_BOOTSTRAP = `const queued = [];
const queue = (event) => {
    event.stopImmediatePropagation();
    queued.push(event);
};
self.addEventListener('message', ({data}) => {
    self.addEventListener('message', queue);
    import(data).then(() => {
        self.removeEventListener('message', queue);
        for (const event of queued.splice(0)) self.dispatchEvent(new MessageEvent('message', {data: event.data, ports: event.ports}));
    }, (error) => {
        reportError(error);
        self.close();
    });
}, {once: true});`;

let classicWorkerBootstrapUrl: string;

/**
 * Returns the Blob URL of {@link CLASSIC_WORKER_BOOTSTRAP}. It's created once and never revoked, since WebKit
 * doesn't let a worker read the page's `blob:` URLs when the worker's own Blob URL is revoked before it loads.
 */
function getClassicWorkerBootstrapUrl(): string {
    classicWorkerBootstrapUrl ||= URL.createObjectURL(new Blob([CLASSIC_WORKER_BOOTSTRAP], {type: 'text/javascript'}));
    return classicWorkerBootstrapUrl;
}

function importAsBlobUrl(url: string): string {
    const blob = new Blob([`import ${JSON.stringify(new URL(url, import.meta.url).href)}`], {type: 'text/javascript'});
    return URL.createObjectURL(blob);
}

export async function workerFactory(): Promise<Worker> {
    const url = config.WORKER_URL || defaultWorkerUrl();
    const asModule = !isClassicWorkerUrl(url);

    if (asModule && hasOpaqueOrigin()) {
        const moduleUrl = url.startsWith('blob:') ? await fetchAsDataUrl(url) : new URL(url, document.baseURI).href;
        const worker = createWorker(getClassicWorkerBootstrapUrl(), false);
        worker.postMessage(moduleUrl);
        return worker;
    }

    if (!isCrossOrigin(url)) {
        return createWorker(url, asModule);
    }

    if (asModule) {
        const blobUrl = importAsBlobUrl(url);
        try {
            return createWorker(blobUrl, asModule);
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    const blobUrl = await fetchAsBlobUrl(url);
    try {
        return createWorker(blobUrl, asModule);
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}
