# Next.js example

Minimal Next.js app exercising the ESM build under Turbopack, Next's default bundler:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field, from a client component.
- `scripts/copy-maplibre-worker.mjs` copies the pre-built worker and shared files into `public/maplibre/`, and `setWorkerUrl` points at the served path. The worker's internal `import from './maplibre-gl-shared.mjs'` resolves because both files are copied side-by-side.

The `new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)` form used by the webpack example does not work here. Both of Next's bundlers emit the worker as a hashed asset without emitting its `maplibre-gl-shared.mjs` sibling, so the worker 404s on its first import and the map requests no tiles. Serving both files from `public/` avoids that.

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
