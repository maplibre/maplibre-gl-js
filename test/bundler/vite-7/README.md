# Vite 7 example

Minimal Vite 7 app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field.
- `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` imports the worker file purely for its URL, and `setWorkerUrl(workerUrl)` points MapLibre at it. The `?url` query is Vite's idiomatic mechanism and works in both dev and production builds.

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
