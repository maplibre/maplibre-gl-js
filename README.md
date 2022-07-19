![MapLibre Logo](https://maplibre.org/img/maplibre-logo-big.svg)

# MapLibre GL JS

**[MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/api/)** is an open-source library for publishing maps on your websites. Fast displaying of maps is possible thanks to GPU-accelerated vector tile rendering. 

It originated as an open-source fork of [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js), before their switch to a non-OSS license in December 2020. The library is intended to be a drop-in replacement for the Mapbox’s version with additional functionality.

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg?style=flat)](LICENSE.txt)[![Version](https://img.shields.io/npm/v/maplibre-gl?style=flat)](https://www.npmjs.com/package/maplibre-gl)[![CI](https://github.com/maplibre/maplibre-gl-js/actions/workflows/ci.yml/badge.svg)](https://github.com/maplibre/maplibre-gl-js/actions/workflows/ci.yml)[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](https://opensource.org/licenses/BSD-3-Clause)

<br />

## Getting Started

Include the JavaScript and CSS files in the <head> of your HTML file.

``` html
<script src='https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js'></script>
<link href='https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css' rel='stylesheet' />
```

Include the following code in the <body> of your HTML file.

``` html
<div id='map' style='width: 400px; height: 300px;'></div>
<script>
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json', // stylesheet location
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
</script>
```

Enjoy the map!

<br />

## Documentation

Full documentation for this library [is available here](https://maplibre.org/maplibre-gl-js-docs/api/).

Check out the features through [examples](https://maplibre.org/maplibre-gl-js-docs/example/).

| Showcases |      |
| ---- | ---- |
|![Display a map](https://maplibre.org/maplibre-gl-js-docs/assets/simple-map-800-22a3f5b6410f543ab214e14f68fb42ec.png)	|![Third party vector tile source](https://maplibre.org/maplibre-gl-js-docs/assets/third-party-800-e047007bba338f6ec7d6cd47abfed279.png)	|
|![Animate a series of images](https://maplibre.org/maplibre-gl-js-docs/assets/animate-images-800-497358611dbe047f300faeb9465aad5f.png)	|![Create a heatmap layer](https://maplibre.org/maplibre-gl-js-docs/assets/heatmap-layer-800-05c0f97ddb6b1a10e84b5064564e86ff.png)	|
|![3D buildings](https://maplibre.org/maplibre-gl-js-docs/assets/3d-buildings-800-bd7885f07050dbbfee7a9bb800ff5ce8.png)	|![Visualize population density](https://maplibre.org/maplibre-gl-js-docs/assets/visualize-population-density-800-6c65712d9ea94eb6d2bd3348a82b9bdf.png)	|

<br />

## Migrating from mapbox-gl

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

<br />

## Contribution

### Getting Involved

Join the #maplibre slack channel at OSMUS: get an invite at https://osmus-slack.herokuapp.com/

### Community Leadership

You can find the official status of the backing community and steering committee in the [COMMUNITY.md](COMMUNITY.md) document.

### Avoid Fragmentation

If you depend on a free software alternative to `mapbox-gl-js`, please consider joining our effort! Anyone with a stake in a healthy community-led fork is welcome to help us figure out our next steps. We welcome contributors and leaders! MapLibre GL already represents the combined efforts of a few early fork efforts, and we all benefit from "one project" rather than "our way". If you know of other forks, please reach out to them and direct them here.

### Roadmap

This project's initial plans are outlined in the [Roadmap](https://github.com/maplibre/maplibre-gl-js/projects/2) project. The primary goal is consistency and continued bug fixes and maintenance as we advance. 

> **MapLibre GL** is developed following [Semantic Versioning (2.0.0)](https://semver.org/spec/v2.0.0.html).

<br />

## Sponsors

We thank everyone who supported us financially in the past and special thanks to the people and organizations who support us with recurring dontations:  

[MIERUNE Inc.](https://www.mierune.co.jp/?lang=en) [@MIERUNE](https://github.com/MIERUNE), [@jawg](https://github.com/jawg), [@nekoyasan](https://github.com/nekoyasan), [@atierian](https://github.com/atierian), [@photoprism](https://github.com/photoprism), [@kaplanlior](https://github.com/kaplanlior), [@francois2metz](https://github.com/francois2metz), [@Schneider-Geo](https://github.com/Schneider-Geo), [@serghov](https://github.com/serghov), [@ambientlight](https://github.com/ambientlight), [@joschi77](https://github.com/joschi77), [@geoffhill](https://github.com/geoffhill), [@jasongode](https://github.com/jasongode)

<br />

## Thank you Mapbox 🙏🏽

We'd like to acknowledge the amazing work Mapbox has contributed to open source. The open source community is sad to part ways with them, but we simultaneously feel grateful for everything they already contributed. `mapbox-gl-js` 1.x is an open source achievement which now lives on as `maplibre-gl`. We're proud to develop on the shoulders of giants, thank you Mapbox 🙇🏽‍♀️.

Please keep in mind: Unauthorized backports are the biggest threat to the MapLibre project. It is unacceptable to backport code from mapbox-gl-js, which is not covered by the former BSD-3 license. If you are unsure about this issue, [please ask](https://github.com/maplibre/maplibre-gl-js/discussions)!

<br />

## License

**MapLibre GL** is licensed under the [3-Clause BSD license](./LICENSE.txt).
