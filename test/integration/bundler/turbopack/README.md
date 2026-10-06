# Turbopack example

Minimal app exercising the ESM build under Turbopack. Turbopack ships as the default bundler in Next.js and is not practical to drive standalone, so this example is a Next.js app:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field, from a client component.
- `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())` makes Next.js emit the pre-built worker as a hashed asset and points MapLibre at it.

`output: 'export'` keeps the build a plain static site, so the bundler test harness can serve it the same way it serves the other examples.

`.npmrc` sets `install-links=true`. Without it npm symlinks the `file:` dependency into the repo root, Turbopack infers its project root from the root lockfile and treats the library's own `dist/` as first-party source, and the worker's dynamic `new URL(..., import.meta.url)` becomes a hard build error rather than the warning a published package gets.

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
