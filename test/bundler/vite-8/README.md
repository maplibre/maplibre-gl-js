# Vite 8 example

Minimal Vite 8 app exercising the ESM build. Identical to the Vite 7 example: the same `import workerUrl from 'maplibre-gl/worker?url'` pattern works in both Vite 7 and Vite 8 regardless of whether dependency pre-bundling is done by esbuild or Rolldown.

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
