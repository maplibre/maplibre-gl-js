# esbuild example

Minimal esbuild app exercising the ESM build:

- All library imports (`maplibre-gl`, `maplibre-gl/dist/maplibre-gl.css`) resolve via the package's `exports` field.
- `build.js` runs esbuild with `splitting: true` and `format: 'esm'`, which preserves the library's internal `import()` call as a real dynamic import and extracts the shared chunk into a separate file.

## Setup

From the repo root, build the parent package once so `dist/` is populated:

```bash
npm install
npm run build-dist
```

Then in this directory:

```bash
npm install
npm run build       # produces dist/main.js, dist/main.css, dist/chunk-*.js, dist/maplibre-gl-worker-*.js
npm run serve       # serve at http://localhost:3000
```
