# Introduction

MapLibre GL JS is a TypeScript library that uses WebGL to render interactive maps from vector tiles in a browser. The customization of the map comply with the [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec). It is part of the [MapLibre ecosystem](https://github.com/maplibre), with a pendant for Mobile, Desktop, Servers called [MapLibre Native](https://maplibre.org/projects/maplibre-native/).


## Quickstart

<iframe src="./example/simple-map.html" width="100%" style="border:none"></iframe>

```html
<div id="map"></div>
<script>
    var map = new maplibregl.Map({
        container: 'map', // container id
        style: 'https://demotiles.maplibre.org/style.json', // style URL
        center: [0, 0], // starting position [lng, lat]
        zoom: 1 // starting zoom
    });
</script>
```


## Reading this documentation

This documentation is divided into several sections:

* [**Main**](./API/#main) - The Main section holds the following classes
    * `Map` object is the map on your page. It lets you access methods and properties for interacting with the map's style and layers, respond to events, and manipulate the user's perspective with the camera.
    * `MaplibreGL` object is MapLibre GL JS's global properties and options that you might want to access while initializing your map or accessing information about its status.
* [**Markers and Controls**](./API//#markers-and-controls) - This section describes the user interface elements that you can add to your map. The items in this section exist outside of the map's `canvas` element. This consists of `Marker`, `Popup` and all the controls.
* [**Geography and geometry**](./API/#geography-and-geometry) - This section includes general utilities and types that relate to working with and manipulating geographic information or geometries.
* [**User interaction handlers**](./API/#handlers) - The items in this section relate to the ways in which the map responds to user input.
* [**Sources**](./API/#sources) - This section describes the source types MapLibre GL JS can handle besides the ones described in the [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/).
* [**Event Related**](./API/#event-related) - This section describes the different types of events that MapLibre GL JS can raise.

Each section describes classes or objects as well as their **properties**, **parameters**, **instance members**, and associated **events**. Many sections also include inline code examples and related resources.

In the examples, we use vector tiles our [Demo tiles repository](https://github.com/maplibre/demotiles) and from [MapTiler](https://maptiler.com). Get your own API key if you want to use MapTiler data in your project.

## CSP Directives

As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/Security/CSP) to specify security policies for your website. If you do, MapLibre GL JS requires the following CSP directives:

```
worker-src blob: ;
child-src blob: ;
img-src data: blob: ;
```

Requesting styles from Mapbox or other services will require additional directives. For Mapbox, you can use this `connect-src` directive:

```
connect-src https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com
```

For strict CSP environments without `worker-src blob: ; child-src blob:` enabled, there's a separate MapLibre GL JS bundle (`maplibre-gl-csp.js` and `maplibre-gl-csp-worker.js`) which requires setting the path to the worker manually:


```html
<script>
maplibregl.workerUrl = "${urls.js().replace('.js', '-csp-worker.js')}";
...
</script>
```

## MapLibre CSS

The CSS referenced in the Quickstart is used to style DOM elements created by MapLibre code. Without the CSS, elements like Popups and Markers won't work.

Including it with a `<link>` in the head of the document via the UNPKG CDN is the simplest and easiest way to provide the CSS, but it is also bundled in the MapLibre module, meaning that if you have a bundler that can handle CSS, you can import the CSS from `maplibre-gl/dist/maplibre-gl.css`.

Note too that if the CSS isn't available by the first render, as soon as the CSS is provided, the DOM elements that depend on this CSS should recover.

## CDN

The MapLibre GL JS (`.js` & `.css`) are distributed via [UNPKG.com](https://unpkg.com).
You can view a listing of all the files in the MapLibre GL JS package by appending a `/` at the end of the MapLibre slug. This is useful to review other revisions or to review the files at UNPKG or the LICENSE. See examples in the following table:

*Examples*

| Use Case  | `.js` | `.css` |
| :------- | :---: | :----: |
| `latest` | <https://unpkg.com/maplibre-gl/dist/maplibre-gl.js> | <https://unpkg.com/maplibre-gl/dist/maplibre-gl.css> |
| Use at least `2.4.x` | <https://unpkg.com/maplibre-gl@^2.4/dist/maplibre-gl.js> | <https://unpkg.com/maplibre-gl@^2.4/dist/maplibre-gl.css> |
