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

## `setWorkerUrl()` is now required

Every consumer needs a one-time [`setWorkerUrl()`](../API/functions/setWorkerUrl.md) call to point MapLibre at the worker file. The exact form depends on your bundler. See [Installation](../index.md#installation) for per-bundler snippets.

## CSP directives

The dedicated CSP bundle from v5 is no longer needed. The default ESM build loads the worker from a real URL (set via `setWorkerUrl()`), so the `blob:` worker source is no longer required. If your CSP previously included `worker-src blob:` or `child-src blob:` only because of MapLibre, you can drop those.

The required directives now reduce to:

```
worker-src 'self' ;
img-src data: blob: 'self' ;
```

## zoomLevelsToOverscale

In version 5 there was an experimental parameter added to allow slicing vector tiles instead of overscaling them.
We tested it, and it looks like it fixes a lot of issue in labeling etc.
It does changes rendering and the results of queryRenderedFeatures.
If you would like to revert to the previous behavior you can set `zoomLevelsToOverscale: undefined` when initializing the map.