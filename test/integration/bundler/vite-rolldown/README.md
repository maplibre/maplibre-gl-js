# Vite 8+ (Rolldown) example

Minimal Vite 8+ (Rolldown) app exercising the ESM build. Identical to the Vite 7 (Rollup/esbuild) example: the same `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` pattern works regardless of whether dependency pre-bundling is done by esbuild or Rolldown.

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
