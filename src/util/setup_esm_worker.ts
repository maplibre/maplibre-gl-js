/**
 * ESM Worker Setup
 * Automatically configures the worker URL for ESM builds
 */

import {config} from './config';

// Only run in browser environment
if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    // Try to detect if we're running as an ES module
    try {
        // @ts-ignore - import.meta might not be available
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            // Derive worker URL from current module URL
            // @ts-ignore
            const moduleUrl = import.meta.url;
            const workerUrl = moduleUrl.replace(/maplibre-gl(-dev)?\.mjs/, 'maplibre-gl-worker$1.mjs').replace(/maplibre-gl(-dev)?\.js/, 'maplibre-gl-worker$1.js');
            
            // Set the worker URL immediately
            config.WORKER_URL = workerUrl;
        }
    } catch (e) {
        // import.meta not available, likely not running as ESM
        console.debug('ESM worker setup: import.meta not available');
    }
}

export function setupWorkerUrl(url: string) {
    config.WORKER_URL = url;
}