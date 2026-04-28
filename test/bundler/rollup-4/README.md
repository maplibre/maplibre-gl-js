# Rollup example

Minimal Rollup app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/css'` resolve via the package's `exports` field.
- `rollup-plugin-copy` copies `maplibre-gl-worker.mjs` from `node_modules` to the bundle output. `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` then references it as a sibling of the bundled `main.js`.

This is the simplest reliable Rollup setup: the `import.meta.url` evaluation happens at runtime in the browser and doesn't require a transform plugin.

## Setup

From the repo root, build the parent package once so `dist/` is populated:

```bash
npm install
npm run build-dist
```

Then in this directory:

```bash
npm install
npm run build       # produces dist/main.js, dist/main.css, dist/maplibre-gl-worker.mjs
npm run serve       # serve at http://localhost:3000
```

For watch mode use `npm run dev` in one terminal and `npm run serve` in another.
