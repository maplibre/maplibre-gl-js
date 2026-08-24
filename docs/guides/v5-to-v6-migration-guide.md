# v5 to v6 migration guide

MapLibre GL JS v6 ships as ES modules only. The UMD bundle, the separate CSP build, and the CommonJS (`require('maplibre-gl')`) entry from v5 are all gone. The bundle file is now `maplibre-gl.mjs` (and `maplibre-gl-worker.mjs`). If you `require()` the package from Node with no bundler involved, this surfaces as `ERR_PACKAGE_PATH_NOT_EXPORTED`.

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

Pin an explicit major version (e.g. ^6.0.0) rather than `@latest` or an unversioned specifier. Starting with v6, a page pinned to `@latest` goes to a blank gray screen with a 404 in the console.

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

## Nested GeoJSON properties

Nested objects and arrays in GeoJSON feature properties are now preserved: features returned from events and `queryRenderedFeatures` contain them as real objects instead of JSON strings. If you called `JSON.parse` on such properties, remove it — it now throws `SyntaxError: "[object Object]" is not valid JSON`.

```diff
-const info = JSON.parse(e.features[0].properties.info);
+const info = e.features[0].properties.info;
```

## pragma mapbox

In case you were using `#pragma mapbox` in your shared code please replace it with `#pragma maplibre`.
```diff
-#pragma mapbox
+#pragma maplibre
```

## Events

All events are now classes, it is advised not to use `instanceof` but instead check the `type` field. Since the change was from types to classes this shouldn't be a problem in most code bases.

### styleimagemissing

In v6, `styleimagemissing` listeners can no longer resolve the current image request by calling `Map#addImage`. To migrate a listener that supplies missing images, replace it with [`Map#setMissingStyleImageResolver`](../API/classes/Map.md#setmissingstyleimageresolver):

```diff
-map.on('styleimagemissing', ({id}) => {
+map.setMissingStyleImageResolver((id) => {
     map.addImage(id, generateImage(id));
 });
```

The resolver can be synchronous or asynchronous. For asynchronous loading, call `Map#addImage` before the resolver's promise settles. The `styleimagemissing` event can still be used to observe images that remain unresolved.

## WebGL2 is now required

WebGL1 support has been removed; a map now requires WebGL2. A browser or device that does not support WebGL2 may fail to render one under v6. See [caniuse.com/webgl2](https://caniuse.com/webgl2) to check. When WebGL2 is unavailable, the map fires an `error` event whose `error` is a `GPUInitializationError` (check `e.error instanceof GPUInitializationError`, exported from `maplibre-gl`) instead of rendering.

## `map.transform` was removed

The internal `map.transform` property is gone; `Map` now composes a `Camera` rather than extending it. Use `Map`'s public API instead of reaching into `transform`. If you relied on something `transform` exposed that isn't covered by the public API, please open an issue or PR.
