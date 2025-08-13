// ESM entry point for MapLibre GL JS
// Re-export everything from the main index module

export * from '../../staging/esm/index.js';

// Create a default export object with all named exports for compatibility
import * as maplibregl from '../../staging/esm/index.js';
export default maplibregl;