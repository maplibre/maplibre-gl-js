# Bundler examples

Standalone apps that exercise `maplibre-gl`'s ESM build through real bundlers. Each subdirectory is self-contained: it links the parent package via `file:../../..`, so `npm install` resolves `import 'maplibre-gl'`, `import 'maplibre-gl/css'`, and `import 'maplibre-gl/worker?url'` exactly as a downstream consumer would.

| Directory | Bundler version |
|---|---|
| `vite-7/` | Vite 7 |
| `vite-8/` | Vite 8 |

Both examples use the same `import workerUrl from 'maplibre-gl/worker?url'` pattern. Vite does not extend `import.meta.url`-based asset detection to files in `node_modules`, so the auto-detection that works for direct browser ESM does not fire when maplibre-gl is consumed via npm. The `?url` query is Vite's idiomatic mechanism for getting the bundled URL of a file, and it works in dev and production for both versions.

To run any of them:

```bash
# From repo root, build the parent once so dist/ is populated.
npm install
npm run build-dist

cd test/bundler/<name>
npm install
npm run dev
```

These examples are not part of CI. They exist to verify that maplibre-gl's package layout and `exports` field work correctly with real bundler tooling.
