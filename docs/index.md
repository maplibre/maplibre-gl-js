# Introduction

MapLibre GL JS is a TypeScript library that uses WebGL to render interactive maps from vector tiles in a browser.
The map’s appearance is controlled by a style document whose structure and properties are defined by the [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec).
It is part of the MapLibre ecosystem, with a counterpart for Android, iOS and other platforms called [MapLibre Native](https://github.com/maplibre/maplibre-native).

## Quickstart

<iframe src="./examples/display-a-globe-with-a-vector-map.html" width="100%" height="400px" style="border:none"></iframe>

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl.css" />
<div id="map" style="height: 400px"></div>
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl.mjs';

    maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl-worker.mjs');

    const map = new maplibregl.Map({
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
import {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new Map({
    container: 'map', // container id
    style: 'https://demotiles.maplibre.org/globe.json', // style URL
    center: [0, 0], // starting position [lng, lat]
    zoom: 1 // starting zoom
});
```

See the [ESM](#esm) section below for setting up the worker URL with your bundler.

## ESM

MapLibre GL JS v6 ships as ES modules only (`maplibre-gl.mjs`). The `"module"` field in `package.json` points at the ESM bundle, so bundlers pick it up automatically.

For minimal runnable apps per bundler (Vite, webpack, esbuild, Rollup), see [`test/integration/bundler/`](https://github.com/maplibre/maplibre-gl-js/tree/main/test/integration/bundler).

Upgrading from v5? See the [v5 to v6 migration guide](./guides/v5-to-v6-migration-guide.md).

### Installation

Pick your setup:

=== "Vite"

    Use Vite's `?url` query to get the worker file's bundled URL:

    ```ts
    import {Map, setWorkerUrl} from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

    setWorkerUrl(workerUrl);

    const map = new Map({/* … */});
    ```

    Works in modern Vite, dev and production.

    If your build uses SSR (TanStack Start, Astro, etc.) and Vite resolves the CommonJS entry on the server, also add:

    ```ts
    // vite.config.ts
    export default defineConfig({
        ssr: {noExternal: ['maplibre-gl']}
    });
    ```

=== "webpack 5+"

    ```ts
    import {Map, setWorkerUrl} from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

    const map = new Map({/* … */});
    ```

    rspack and rsbuild use the same pattern.

=== "esbuild"

    ```js
    // build.js
    import * as esbuild from 'esbuild';
    import {copyFileSync} from 'fs';

    await esbuild.build({
        entryPoints: ['src/main.ts'],
        bundle: true,
        outdir: 'dist',
        format: 'esm'
    });

    copyFileSync(
        'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
        'dist/maplibre-gl-worker.mjs'
    );
    ```

    ```ts
    // src/main.ts
    import {Map, setWorkerUrl} from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString());

    const map = new Map({/* … */});
    ```

=== "Rollup"

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
    import 'maplibre-gl/dist/maplibre-gl.css';

    setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).toString());

    const map = new Map({/* … */});
    ```

=== "CDN / No bundler"

    Load MapLibre directly from UNPKG as an ES module via a `<script type="module">` tag. See [unpkg.com](https://unpkg.com) for instructions on selecting specific versions and semver ranges.

    ```html
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl.css" />
    <div id="map" style="height: 400px"></div>
    <script type="module">
        import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl.mjs';

        maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@^6.0.0-5/dist/maplibre-gl-worker.mjs');

        const map = new maplibregl.Map({
            container: 'map',
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 1
        });
    </script>
    ```

    See the [Display a map](./examples/display-a-map.md) example for a runnable version.

## CSP Directives

As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/Security/CSP) to specify security policies for your website. If you do, MapLibre GL JS requires the following CSP directives:

```
worker-src 'self' ;
img-src data: blob: 'self' ;
```

## MapLibre CSS

The CSS referenced in the Quickstart is used to style DOM elements created by MapLibre code. Without the CSS, elements like Popups and Markers won't work.

Including it with a `<link>` in the head of the document via the UNPKG CDN is the simplest and easiest way to provide the CSS, but it is also bundled in the MapLibre module, meaning that if you have a bundler that can handle CSS, you can import the CSS from `maplibre-gl/dist/maplibre-gl.css`.

Note too that if the CSS isn't available by the first render, as soon as the CSS is provided, the DOM elements that depend on this CSS should recover.
