# webpack 5 example

Minimal webpack 5 app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field.
- `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())` constructs the worker URL. webpack recognizes the `new URL(..., import.meta.url)` pattern, resolves the package specifier, copies the worker file to the build output, and rewrites the URL at build time.

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
