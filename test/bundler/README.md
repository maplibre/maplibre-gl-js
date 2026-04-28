# Bundler examples

Standalone apps that exercise `maplibre-gl`'s ESM build through real bundlers. Each subdirectory is self-contained: it depends on the parent package via `file:../../..`, so `npm install` copies the parent's `dist/` into the example's `node_modules` and the example then resolves `import 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` exactly as a downstream consumer would.

| Directory | Bundler | Worker URL setup |
|---|---|---|
| `vite-7/` | Vite 7 | `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` |
| `vite-8/` | Vite 8 | `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` |
| `webpack-5/` | webpack 5 | `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())` |
| `rollup-4/` | Rollup 4 | `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` (worker copied next to the bundle via `rollup-plugin-copy`) |
| `esbuild/` | esbuild | `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` (worker copied next to the bundle in `build.js`) |

All five use the same library imports: `import {Map} from 'maplibre-gl'`, `import 'maplibre-gl/dist/maplibre-gl.css'`. The differences are in how each bundler resolves the worker URL.

To run any of them:

```bash
# From repo root: build the parent's production bundles. Required because
# every example references `dist/maplibre-gl-worker.mjs` (the production
# name); `build-dev` alone produces only the `-dev` variant and the
# examples will fail to copy.
npm install
npm run build-dist

cd test/bundler/<name>
npm install
npm run dev      # vite-7, vite-8, webpack-5
# or:
npm run build && npm run serve   # rollup-4, esbuild
```

These examples are not part of CI. They exist to verify that maplibre-gl's package layout and `exports` field work correctly with real bundler tooling, and to document each bundler's worker-URL setup.
