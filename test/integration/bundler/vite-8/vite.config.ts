import {defineConfig} from 'vite';

// Vite 8 replaces esbuild with Rolldown for dependency pre-bundling. Rolldown
// preserves `new URL('./worker.mjs', import.meta.url)` correctly, so the
// auto-detection in `maplibre-gl.mjs` works in dev mode without any
// `optimizeDeps.exclude` workaround. Production builds work either way.
export default defineConfig({});
