# MapBox migration guide

This part of the docs is dedicated to the migration from `mapbox-gl` to `maplibre-gl`.

This guide might not be accurate depending on the current version of `mapbox-gl` but should be fairly straight forward.

The libraries are very similar but diverge with newer features happening from v2 in both libraries where Mapbox turned proprietary.

The overall migration happens by uninstalling `mapbox-gl` and installing `maplibre-gl` in your node packages (or see below for CDN links), and replacing `mapboxgl` with `maplibregl` throughout your TypeScript, JavaScript and HTML/CSS.

```diff
-    var map = new mapboxgl.Map({
+    var map = new maplibregl.Map({

-    <button class="mapboxgl-ctrl">
+    <button class="maplibregl-ctrl">
```

#### Compatibility branch

MapLibre GL JS v1 is completely backward compatible with Mapbox GL JS v1. This compatibility branch (named 1.x) is tagged v1 on npm, and its current version is 1.15.3. 

#### CDN Links

> MapLibre GL JS is distributed via [unpkg.com](https://unpkg.com).

```diff
-    <script src="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.js"></script>
-    <link
-      href="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.css"
-      rel="stylesheet"
-    />


+    <script src="https://unpkg.com/maplibre-gl@#.#.#/dist/maplibre-gl.js"></script>
+    <link
+      href="https://unpkg.com/maplibre-gl@#.#.#/dist/maplibre-gl.css"
+      rel="stylesheet"
+    />

```

Don't forget to replace the version above `#.#.#` with the version you would like to use.
In the upper right corner of this page you can find the number of the latest version.
