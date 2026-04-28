# Vite 7 example

Minimal Vite 7 app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/css'` resolve via the package's `exports` field.
- `import workerUrl from 'maplibre-gl/worker?url'` imports the worker file purely for its URL. `setWorkerUrl(workerUrl)` then points MapLibre at it.

## Why the explicit worker URL?

The `import.meta.url`-based auto-detection inside `maplibre-gl.mjs` works for source code that Vite processes, but Vite does not extend the same asset detection to files inside `node_modules`. The `?url` query is Vite's idiomatic mechanism for "give me the bundled URL of this file," and it works in both dev and production builds.

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
