# Using the ESM build

MapLibre GL JS v6 ships an ES module build (`maplibre-gl.mjs`) alongside the classic UMD bundle. The `"module"` field in `package.json` points at the ESM bundle, so bundlers pick it up automatically. Every consumer of the ESM build needs to point MapLibre at the worker URL with [`setWorkerUrl()`](../API/functions/setWorkerUrl.md); each environment below shows how to wire it up.

## Migrating to ESM

If you import maplibre-gl from npm, your `import` lines are unchanged: in v6 the package resolves to the ESM bundle automatically.

If you load maplibre-gl via `<script src>`, switch to a module script:

```html
<!-- before -->
<script src="https://unpkg.com/maplibre-gl@^5/dist/maplibre-gl.js"></script>

<!-- after -->
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';
</script>
```

The ESM build also requires a one-time `setWorkerUrl()` call (shown in the subsections below).

## In the browser, without a bundler

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.css" />
<div id="map" style="height: 400px"></div>
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';

    maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl-worker.mjs');

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [0, 0],
        zoom: 1
    });
</script>
```

See the [Display a map with ESM](../examples/display-a-map-with-esm.md) example for a runnable version.

## Vite

Use Vite's `?url` query to get the worker file's bundled URL:

```ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';
import workerUrl from 'maplibre-gl/worker?url';

setWorkerUrl(workerUrl);

const map = new Map({/* … */});
```

Works in Vite 7 and Vite 8, dev and production.

If your build uses SSR (TanStack Start, Astro, etc.) and Vite resolves the CommonJS entry on the server, also add:

```ts
// vite.config.ts
export default defineConfig({
    ssr: {noExternal: ['maplibre-gl']}
});
```

## webpack 5+

```ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';

setWorkerUrl(new URL('maplibre-gl/worker', import.meta.url).toString());

const map = new Map({/* … */});
```

rspack and rsbuild use the same pattern.

## esbuild

```js
// build.js
import * as esbuild from 'esbuild';
import {fileURLToPath} from 'url';
import {copyFileSync} from 'fs';

await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outdir: 'dist',
    format: 'esm'
});

copyFileSync(
    fileURLToPath(import.meta.resolve('maplibre-gl/worker')),
    'dist/maplibre-gl-worker.mjs'
);
```

```ts
// src/main.ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';

setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString());

const map = new Map({/* … */});
```

## Rollup

```ts
// rollup.config.js
import {fileURLToPath} from 'url';
import copy from 'rollup-plugin-copy';

const workerSrc = fileURLToPath(import.meta.resolve('maplibre-gl/worker'));

export default {
    plugins: [
        copy({targets: [{src: workerSrc, dest: 'dist'}]}),
        /* ... */
    ]
};
```

```ts
// src/main.ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';

setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString());

const map = new Map({/* … */});
```
