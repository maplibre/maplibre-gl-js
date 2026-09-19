# Rollup example

Minimal Rollup app exercising the ESM build:

- All library imports (`maplibre-gl`, `maplibre-gl/dist/maplibre-gl.css`) resolve via the package's `exports` field.
- `rollup-plugin-copy` copies the worker file to the bundle output. `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` references it relative to the bundle at runtime.

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
