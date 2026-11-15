# Mapbox migration guide

This part of the docs is dedicated to the migration from `mapbox-gl` to `maplibre-gl`.

The overall migration happens by uninstalling `mapbox-gl` and installing `maplibre-gl` in your node packages (or see below for CDN links), and replacing `mapboxgl` with `maplibregl` throughout your TypeScript, JavaScript and HTML/CSS.

```diff
-    var map = new mapboxgl.Map({
+    var map = new maplibregl.Map({

-    <button class="mapboxgl-ctrl">
+    <button class="maplibregl-ctrl">
```

#### CDN Links

> MapLibre GL JS is distributed via [unpkg.com](https://unpkg.com).

```diff
-    <script src="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.js"></script>
-    <link
-      href="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.css"
-      rel="stylesheet"
-    />

+    <script type="module">
+      import * as maplibregl from 'https://unpkg.com/maplibre-gl@#.#.#/dist/maplibre-gl.mjs';
+    </script>
+    <link
+      href="https://unpkg.com/maplibre-gl@#.#.#/dist/maplibre-gl.css"
+      rel="stylesheet"
+    />

```

Replace `#.#.#` with a pinned version, for example `^6.0.0`.

v6 ships as ES modules only, so there is no `<script src>` build: `maplibre-gl.js` returns a 404, and `maplibregl` is not a global. Put the code that uses it in the same `<script type="module">`, or in another module that imports it.

## Understanding the differences between MapLibre and Mapbox GL JS

Review the MapLibre [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) for breaking changes in each major release.

In addition, MapLibre maintains its own [Style Specification](https://maplibre.org/maplibre-style-spec/), forked from the Mapbox one. Most styles are compatible, but the spec has added and diverged in places, so check it when using newer or MapLibre-specific features.

### Background: the fork

In December 2020 Mapbox released GL JS v2.0 under a proprietary license. The community forked the last open-source release, v1.13, as MapLibre GL JS. Because of that, a Mapbox GL JS v2 or later API exists in MapLibre only where MapLibre contributors independently reimplemented it, sometimes under a different name.

### Compatibility branch

MapLibre GL JS v1 is completely backward compatible with Mapbox GL JS v1. This compatibility branch (named 1.x) is tagged v1 on npm, and its current version is 1.15.3.

### Migrating from Mapbox GL JS v2 or v3

After swapping the package and namespace, use TypeScript if you can: `maplibre-gl` ships its own types, so a missing method or a changed signature (for example a callback passed to `map.loadImage`, which returns a Promise) shows up as a compile error. Without TypeScript, run your app and check the browser console. Either way, if a method is missing (for example `map.setFog is not a function`), look it up in the [API reference](https://maplibre.org/maplibre-gl-js/docs/API/). MapLibre may offer the feature under a different name or a different implementation path, or may not offer it yet.

## Why migrate

- **Open-source license.** MapLibre GL JS is BSD-3-Clause, with no proprietary terms.
- **No access token.** The library does not need one. Tile sources may have their own keys, or none (for example OpenFreeMap).
- **Cost.** You avoid Mapbox map-load and API pricing and can use free or fixed-cost tile and geocoding providers.
- **Self-hosting.** Use your own tiles ([PMTiles](https://docs.protomaps.com/pmtiles/), [tileserver-gl](https://github.com/maptiler/tileserver-gl), [Martin](https://maplibre.org/martin/)) or any third-party source.
- **Community governance.** The style spec and APIs evolve in the open, and the project is funded by donations and sponsorships from many companies and individuals.
- **Open vector tile format.** [MapLibre Tile (MLT)](https://maplibre.org/maplibre-tile-spec/) is a newer alternative to Mapbox Vector Tiles with better compression and support for 3D coordinates. GL JS and MapLibre Native can both read it, by setting `encoding: mlt` on a source.
- **Open-source ecosystem.** MapLibre GL JS is part of a wider ecosystem. Supported projects, roadmaps and news are at [maplibre.org/roadmap](https://maplibre.org/roadmap/) and [maplibre.org/news](https://maplibre.org/news/). Community-submitted projects are indexed at [awesome-maplibre](https://github.com/maplibre/awesome-maplibre), and [Make with MapLibre](https://makewithmaplibre.com) has a myriad of implementations in production, plus SDKs, frameworks, and libraries to help you build and integrate your MapLibre project.

### What you give up

Mapbox Studio integration, Mapbox-hosted tiles and styles, the Mapbox Search, Directions and Geocoding APIs, and official Mapbox support.
