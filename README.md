# MapLibre GL

**MapLibre GL** is a community-led fork derived from [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) before their switch to a non-OSS license.

### Migrating from mapbox-gl

If you depend on mapbox-gl directly, simply replace `mapbox-gl` with `maplibre-gl` in `package.json`:

Use

```diff
  "dependencies": {
-    "mapbox-gl": "^1.13.0"
+    "maplibre-gl": ">=1.15.2"
  }
```

if it is important to you that the behaviour is similar to `mapbox-gl` version 1.x.

If you are OK with changes that integrate non-backward compatible features, install `maplibre-gl` version 2:

```diff
  "dependencies": {
-    "mapbox-gl": "^1.13.0"
+    "maplibre-gl": ">=2.0.0"
  }
```

And replace `mapboxgl` with `maplibregl` in your JavaScript and optionally in your HTML/CSS code:

> MapLibre GL JS is distributed via [unpkg.com](https://unpkg.com). For more informations please see [MapLibre GL is on unpkg.com](./docs/README-unpkg.md#maplibre-gl-on-unpkgcom).

```diff
-    <script src="https://api.mapbox.com/mapbox-gl-js/v1.13.0/mapbox-gl.js"></script>
-    <link
-      href="https://api.mapbox.com/mapbox-gl-js/v1.13.0/mapbox-gl.css"
-      rel="stylesheet"
-    />

     <!--  Use maplibre-gl version 1.15.2 for backwards compatibility with mapbox-gl version 1.x. -->
+    <script src="https://unpkg.com/maplibre-gl@1.15.2/dist/maplibre-gl.js"></script>
+    <link
+      href="https://unpkg.com/maplibre-gl@1.15.2/dist/maplibre-gl.css"
+      rel="stylesheet"
+    />

-    var map = new mapboxgl.Map({
+    var map = new maplibregl.Map({

-    <button class="mapboxgl-ctrl">
+    <button class="maplibregl-ctrl">
```

Want an example? Have a look at the official [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js-docs/example/).

Use MapLibre GL JS bindings for React (https://visgl.github.io/react-map-gl/docs/get-started/get-started#using-with-a-mapbox-gl-fork) and Angular (https://github.com/maplibre/ngx-maplibre-gl). Find more at [awesome-maplibre](https://github.com/maplibre/awesome-maplibre).

### Roadmap

This project's initial plans are outlined in the [Roadmap](https://github.com/maplibre/maplibre-gl-js/projects/2) project. The primary goal is consistency and continued bug fixes and maintenance as we advance. 

> **MapLibre GL** is developed following [Semantic Versioning (2.0.0)](http://semver.org/spec/v2.0.0.html).

### Getting Involved

Join the #maplibre slack channel at OSMUS: get an invite at https://osmus-slack.herokuapp.com/

### Community Leadership

You can find the official status of the backing community and steering committee in the [COMMUNITY.md](COMMUNITY.md) document.

### Avoid Fragmentation

If you depend on a free software alternative to `mapbox-gl-js`, please consider joining our effort! Anyone with a stake in a healthy community-led fork is welcome to help us figure out our next steps. We welcome contributors and leaders! MapLibre GL already represents the combined efforts of a few early fork efforts, and we all benefit from "one project" rather than "our way". If you know of other forks, please reach out to them and direct them here.

### Thank you Mapbox 🙏🏽

We'd like to acknowledge the amazing work Mapbox has contributed to open source. The open source community is sad to part ways with them, but we simultaneously feel grateful for everything they already contributed. `mapbox-gl-js` 1.x is an open source achievement which now lives on as `maplibre-gl`. We're proud to develop on the shoulders of giants, thank you Mapbox 🙇🏽‍♀️.

Please keep in mind: Unauthorized backports are the biggest threat to the MapLibre project. It is unacceptable to backport code from mapbox-gl-js, which is not covered by the former BSD-3 license. If you are unsure about this issue, [please ask](https://github.com/maplibre/maplibre-gl-js/discussions)!

## License

**MapLibre GL** is licensed under the [3-Clause BSD license](./LICENSE.txt).
