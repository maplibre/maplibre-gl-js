# Bundler examples

Standalone apps that exercise `maplibre-gl`'s ESM build through real bundlers. Each subdirectory is self-contained: it links the parent package via `file:../../..`, so `npm install` resolves `import 'maplibre-gl'`, `import 'maplibre-gl/css'`, and the worker URL exactly as a downstream consumer would.

| Directory | Bundler | Worker URL setup |
|---|---|---|
| `vite-7/` | Vite 7 | `import workerUrl from 'maplibre-gl/worker?url'` |
| `vite-8/` | Vite 8 | `import workerUrl from 'maplibre-gl/worker?url'` |
| `webpack-5/` | webpack 5 | `setWorkerUrl(new URL('maplibre-gl/worker', import.meta.url).toString())` |
| `rollup-4/` | Rollup 4 | `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` (worker copied next to the bundle via `rollup-plugin-copy`) |

All four use the same library imports: `import {Map} from 'maplibre-gl'`, `import 'maplibre-gl/css'`. The differences are in how each bundler resolves the worker URL.

No bundler extends `new URL(..., import.meta.url)` asset detection to expressions inside `node_modules`, so the auto-detection inside `maplibre-gl.mjs` doesn't fire on its own in any of them. Each bundler has its own user-side pattern: `?url` for Vite, `new URL(...)` in user source for webpack, and an explicit copy step for Rollup.

To run any of them:

```bash
# From repo root, build the parent once so dist/ is populated.
npm install
npm run build-dist

cd test/bundler/<name>
npm install
npm run dev      # vite-7, vite-8, webpack-5
# or:
npm run build && npm run serve   # rollup-4
```

These examples are not part of CI. They exist to verify that maplibre-gl's package layout and `exports` field work correctly with real bundler tooling, and to document each bundler's worker-URL setup.
