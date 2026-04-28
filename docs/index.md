# Introduction

MapLibre GL JS is a TypeScript library that uses WebGL to render interactive maps from vector tiles in a browser.
The map’s appearance is controlled by a style document whose structure and properties are defined by the [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec).
It is part of the MapLibre ecosystem, with a counterpart for Android, iOS and other platforms called [MapLibre Native](https://github.com/maplibre/maplibre-native).

## Quickstart

<iframe src="./examples/display-a-globe-with-a-vector-map.html" width="100%" height="400px" style="border:none"></iframe>

```html
<div id="map"></div>
<script>
    var map = new maplibregl.Map({
        container: 'map', // container id
        style: 'https://demotiles.maplibre.org/globe.json', // style URL
        center: [0, 0], // starting position [lng, lat]
        zoom: 2 // starting zoom
    });
</script>
```


## Reading this documentation

This documentation is divided into several sections:

* [**Main**](./API/README.md) - The Main section holds the following classes
    * [`Map`](./API/classes/Map.md) object is the map on your page. It lets you access methods and properties for interacting with the map's style and layers, respond to events, and manipulate the user's perspective with the camera.
    * [`Global Functions`](./API/functions/addProtocol.md) let you set global properties and options that you might want to access while initializing your map or accessing information about its status.
* [**Markers and Controls**](./API/README.md#markers-and-controls) - This section describes the user interface elements that you can add to your map. The items in this section exist outside of the map's `canvas` element. This consists of `Marker`, `Popup` and all the controls.
* [**Geography and geometry**](./API/README.md#geography-and-geometry) - This section includes general utilities and types that relate to working with and manipulating geographic information or geometries.
* [**User interaction handlers**](./API/README.md#handlers) - The items in this section relate to the ways in which the map responds to user input.
* [**Sources**](./API/README.md#sources) - This section describes the source types MapLibre GL JS can handle besides the ones described in the [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/).
* [**Event Related**](./API/README.md#event-related) - This section describes the different types of events that MapLibre GL JS can raise.

Each section describes classes or objects as well as their **properties**, **parameters**, **instance members**, and associated **events**. Many sections also include inline code examples and related resources.

In the examples, we use vector tiles from our [Demo tiles repository](https://github.com/maplibre/demotiles) and from [MapTiler](https://maptiler.com). Get your own API key if you want to use MapTiler data in your project.

## npm

Install the MapLibre GL JS package via [npm](https://www.npmjs.com/package/maplibre-gl).

```bash
npm install maplibre-gl
```

You can then import the MapLibre GL JS module in your project.

```html
<div id="map"></div>
```

```javascript
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/css';

const map = new maplibregl.Map({
    container: 'map', // container id
    style: 'https://demotiles.maplibre.org/globe.json', // style URL
    center: [0, 0], // starting position [lng, lat]
    zoom: 1 // starting zoom
});
```

## ESM

MapLibre GL JS ships an ES module build (`maplibre-gl.mjs`) alongside the classic UMD bundle. The `"module"` field in `package.json` points at the ESM bundle, so bundlers pick it up automatically:

```ts
import {Map} from 'maplibre-gl';
import 'maplibre-gl/css';

const map = new Map({/* … */});
```

Vite, webpack 5+, and Rollup all bundle the companion worker file as a sibling asset with no extra configuration.

### In the browser, without a bundler

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.css" />
<div id="map" style="height: 400px"></div>
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [0, 0],
        zoom: 1
    });
</script>
```

See the [Display a map with ESM](./examples/display-a-map-with-esm.md) example for a runnable version.

### Vite

Vite does not extend `import.meta.url`-based asset detection to files inside `node_modules`, so the auto-detection inside `maplibre-gl.mjs` does not fire when the package is consumed via npm. Use the `?url` query to import the worker file for its URL and pass it to `setWorkerUrl()`:

```ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';
import workerUrl from 'maplibre-gl/worker?url';

setWorkerUrl(workerUrl);

const map = new Map({/* … */});
```

This applies to both Vite 7 and Vite 8 in dev and production.

### webpack 5+

webpack also does not extend its `new URL(..., import.meta.url)` asset detection to expressions inside `node_modules`, so put the URL construction in your own source:

```ts
import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';

setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

const map = new Map({/* … */});
```

webpack resolves the package specifier, copies the worker file to the build output, and rewrites the URL at build time.

### Rollup

Use `rollup-plugin-copy` to put the worker file next to the bundle, then reference it with a relative `new URL(..., import.meta.url)`:

```ts
// rollup.config.js
import copy from 'rollup-plugin-copy';

export default {
    plugins: [
        copy({
            targets: [
                {src: 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', dest: 'dist'}
            ]
        }),
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

### Vite SSR

If your build uses SSR (React Router v7, Astro, etc.) and Vite resolves the CommonJS entry on the server, force the ESM entry:

```ts
// vite.config.ts
export default defineConfig({
    ssr: {noExternal: ['maplibre-gl']}
});
```

### Custom worker URL

If you need to host the worker at a non-default location, override with the `workerUrl` Map option or [`setWorkerUrl()`](./API/functions/setWorkerUrl.md):

```ts
import {Map} from 'maplibre-gl';

const map = new Map({
    container: 'map',
    workerUrl: '/static/maplibre-gl-worker.mjs',
    style: '…'
});
```

Or set it globally before creating any maps:

```ts
import {setWorkerUrl} from 'maplibre-gl';

setWorkerUrl('/static/maplibre-gl-worker.mjs');
```

## CSP Directives

As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/Security/CSP) to specify security policies for your website. If you do, MapLibre GL JS requires the following CSP directives:

```
worker-src blob: ;
child-src blob: ;
img-src data: blob: ;
```

For strict CSP environments without `worker-src blob: ; child-src blob:` enabled, there's a separate MapLibre GL JS bundle (`maplibre-gl-csp.js` and `maplibre-gl-csp-worker.js`, with `.mjs` ESM variants) which requires setting the path to the worker manually:

```html
<script>
maplibregl.setWorkerUrl("${urls.js().replace('.js', '-csp-worker.js')}");
...
</script>
```

## MapLibre CSS

The CSS referenced in the Quickstart is used to style DOM elements created by MapLibre code. Without the CSS, elements like Popups and Markers won't work.

Including it with a `<link>` in the head of the document via the UNPKG CDN is the simplest and easiest way to provide the CSS, but it is also bundled in the MapLibre module, meaning that if you have a bundler that can handle CSS, you can import the CSS from `maplibre-gl/dist/maplibre-gl.css`.

Note too that if the CSS isn't available by the first render, as soon as the CSS is provided, the DOM elements that depend on this CSS should recover.

## CDN

MapLibre GL JS is also distributed via UNPKG. Our latest version can installed by adding below tags this in the html `<head>`. Further instructions on how to select specific versions and semver ranges can be found on at [unpkg.com](https://unpkg.com).

```html
<script src="https://unpkg.com/maplibre-gl@^5.22.0/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@^5.22.0/dist/maplibre-gl.css" rel="stylesheet" />
```
