# Turbopack example

Minimal app exercising the ESM build under Turbopack. Turbopack ships as the default bundler in Next.js and is not practical to drive standalone, so this example is a Next.js app:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field, from a client component.
- `scripts/copy-maplibre-worker.mjs` copies the pre-built worker into `public/maplibre/`, and `setWorkerUrl` points at the served path.

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

`predev` and `prebuild` run the copy script, so the worker is in place for both `next dev` and `next build`.
