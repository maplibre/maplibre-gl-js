# v5 to v6 migration guide

MapLibre GL JS v6 ships as ES modules only. The UMD bundle and the separate CSP build from v5 are gone. The bundle file is now `maplibre-gl.mjs` (and `maplibre-gl-worker.mjs`).

## Imports

If you import maplibre-gl from npm with **named imports** (`import {Map} from 'maplibre-gl'`), your imports keep working: v6 resolves to the ESM bundle automatically.

If you used the **default import** (`import maplibregl from 'maplibre-gl'`), switch to either named imports or a namespace import:

```ts
// before
import maplibregl from 'maplibre-gl';

// after
import * as maplibregl from 'maplibre-gl';
// or pull in just what you need
import {Map, setWorkerUrl} from 'maplibre-gl';
```

## `<script>` tag

If you load maplibre-gl via `<script src>`, switch to a module script:

```html
<!-- before -->
<script src="https://unpkg.com/maplibre-gl@^5/dist/maplibre-gl.js"></script>

<!-- after -->
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';
</script>
```

## `setWorkerUrl()` is bundler-only

For direct browser ESM (loading from a CDN like unpkg via a `<script type="module">` tag), the worker URL is auto-detected from `import.meta.url` and laundered through a same-origin Blob URL when needed, so no [`setWorkerUrl()`](../API/functions/setWorkerUrl.md) call is required.

For bundlers (Vite, webpack, esbuild, rspack, Rollup), `import.meta.url` doesn't reliably resolve to the worker file inside the bundler's module graph, so each consumer still needs a one-time `setWorkerUrl()` call. See [Installation](../index.md#installation) for per-bundler snippets.

## CSP directives

The dedicated CSP bundle from v5 is no longer needed.

If you load MapLibre from a CDN cross-origin to your page (e.g. unpkg), the worker is constructed from a same-origin Blob URL, so your CSP needs to allow `blob:` in `worker-src`:

```
worker-src 'self' blob: ;
img-src data: blob: 'self' ;
```

If you self-host the worker file (any bundler setup), the worker URL is same-origin and `blob:` is not required:

```
worker-src 'self' ;
img-src data: blob: 'self' ;
```

## zoomLevelsToOverscale

In version 5 there was an experimental parameter added to allow slicing vector tiles instead of overscaling them.
We tested it, and it looks like it fixes a lot of issue in labeling etc.
It does changes rendering and the results of queryRenderedFeatures.
If you would like to revert to the previous behavior you can set `zoomLevelsToOverscale: undefined` when initializing the map.