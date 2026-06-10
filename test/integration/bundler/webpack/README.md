# webpack example

Minimal webpack app exercising the ESM build:

- `import {Map} from 'maplibre-gl'` and `import 'maplibre-gl/dist/maplibre-gl.css'` resolve via the package's `exports` field.
- `copy-webpack-plugin` copies the pre-built worker and shared files to the output directory. The worker's internal `import from './maplibre-gl-shared.mjs'` resolves because both files are copied side-by-side.

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
