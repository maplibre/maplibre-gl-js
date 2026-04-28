# webpack 5 example

Minimal webpack 5 app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/css'` resolve via the package's `exports` field.
- `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())` constructs the worker URL in user source code, where webpack's `new URL(..., import.meta.url)` asset detection fires. webpack resolves the package specifier, copies the worker file to the build output, and rewrites the URL at build time.

Like Vite, webpack does not extend the same asset detection to expressions inside `node_modules`, so the auto-detection inside `maplibre-gl.mjs` cannot fire on its own. The pattern stays in user code.

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
