# Vite 7 (Rollup/esbuild) example

Minimal Vite 7 (Rollup/esbuild) app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field.
- `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'` bundles the worker (including its shared chunk dependency) into a single file and returns the URL. `setWorkerUrl(workerUrl)` points MapLibre at it.

## Setup

From the repo root, build the parent package once so `dist/` is populated:

```bash
npm install
npm run build-dist
```

Then in this directory:

```bash
npm install
npm run dev
```
