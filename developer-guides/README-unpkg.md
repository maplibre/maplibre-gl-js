# MapLibre GL JS on unpkg.com

MapLibre GL JS is distributed via [unpkg.com](https://unpkg.com).

> *UNPKG is a fast, global content delivery network for everything on npm.*

These notes on unpkg are tailored for MapLibre GL JS.  For the most up to date documentation be sure to see [maplibre.org/maplibre-gl-js/docs](https://maplibre.org/maplibre-gl-js/docs).  You can see live examples and notes on how to include the JavaScript and CSS files in your project.

You can also use these unpkg notes to review `CHANGELOG`'s or other revisions of MapLibre GL JS.

## Examples

Using a fixed version:

* [https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl.mjs](https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl.mjs)

---

You may also use a [semver range](https://semver.org/) or a [tag](https://docs.npmjs.com/cli/dist-tag) instead of a fixed version number, or omit the version/tag entirely to use the `latest` tag.

* [https://unpkg.com/maplibre-gl@^6.0/dist/maplibre-gl.mjs](https://unpkg.com/maplibre-gl@^6.0/dist/maplibre-gl.mjs) - use at least `6.0.x`
* [https://unpkg.com/maplibre-gl/dist/maplibre-gl.mjs](https://unpkg.com/maplibre-gl/dist/maplibre-gl.mjs) - use the `latest` tag

The matching worker file is served from the same `dist/` folder:

* [https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs](https://unpkg.com/maplibre-gl/dist/maplibre-gl-worker.mjs)

---

If you omit the file path (i.e. use a "bare" URL), unpkg will serve the file specified by the `module` field in `package.json`.

* [https://unpkg.com/maplibre-gl](https://unpkg.com/maplibre-gl)

---

Append a `/` at the end of a URL to view a listing of all the files in a package.

* [https://unpkg.com/maplibre-gl/](https://unpkg.com/maplibre-gl/)

There you can find a `CHANGELOG`
* [https://unpkg.com/browse/maplibre-gl@6.0.0/CHANGELOG.md](https://unpkg.com/browse/maplibre-gl@6.0.0/CHANGELOG.md)

## Query Parameters

`?meta`
    Return metadata about any file in a package as JSON (e.g.`/dist/maplibre-gl.mjs?meta`)

* [https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl.mjs?meta](https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl.mjs?meta)

Example output gives the `lastModified` & `size` metadata.

```javascript
{
  "path": "/dist/maplibre-gl.mjs",
  "type": "file",
  "contentType": "application/javascript",
  "lastModified": "...",
  "size": ...
}
```
