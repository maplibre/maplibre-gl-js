export const defaultWorkerUrl: string = (() => {
    try {
        const moduleUrl = import.meta.url;
        const workerName = moduleUrl.endsWith('-dev.mjs')
            ? 'maplibre-gl-worker-dev.mjs'
            : 'maplibre-gl-worker.mjs';
        return new URL(`./${workerName}`, moduleUrl).href;
    } catch {
        return '';
    }
})();
