# esbuild example

Minimal esbuild app exercising the ESM build:

- All library imports (`maplibre-gl`, `maplibre-gl/css`, `maplibre-gl/worker`) resolve via the package's `exports` field.
- `build.js` runs esbuild and copies the worker file from `maplibre-gl/worker` to `dist/`. `setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString())` references it relative to the bundle at runtime.

esbuild does not recognize the `new URL(..., import.meta.url)` pattern as an asset reference, so the worker is copied explicitly in the build script.

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
