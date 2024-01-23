# MapLibre GL JS on unpkg.com

MapLibre GL JS is distributed via [unpkg.com](https://unpkg.com).

> *UNPKG is a fast, global content delivery network for everything on npm.*

These notes on unpkg are tailored for MapLibre GL JS.  For the most up to date documentation be sure to see [maplibre.org/maplibre-gl-js/docs](https://maplibre.org/maplibre-gl-js/docs).  You can see live examples and notes on how to include the JavaScript and CSS files in your project.

You can also use these unpkg notes to review `CHANGELOG`'s or other revisions of MapLibre GL JS.

## Examples

Using a fixed version:

* [https://unpkg.com/maplibre-gl@1.14.0/dist/maplibre-gl.js](https://unpkg.com/maplibre-gl@1.14.0/dist/maplibre-gl.js)

---

You may also use a [semver range](https://semver.org/) or a [tag](https://docs.npmjs.com/cli/dist-tag) instead of a fixed version number, or omit the version/tag entirely to use the `latest` tag.

* [https://unpkg.com/maplibre-gl@^1.14/dist/maplibre-gl.js](https://unpkg.com/maplibre-gl@^1.14/dist/maplibre-gl.js) - use at least `1.14.x`
* [https://unpkg.com/maplibre-gl/dist/maplibre-gl.js](https://unpkg.com/maplibre-gl/dist/maplibre-gl.js) - use the `latest` tag

---

If you omit the file path (i.e. use a “bare” URL), unpkg will serve the file specified by the `unpkg` field in `package.json`, or fall back to `main`.

* [https://unpkg.com/maplibre-gl](https://unpkg.com/maplibre-gl)

---

Append a `/` at the end of a URL to view a listing of all the files in a package.

* [https://unpkg.com/maplibre-gl/](https://unpkg.com/maplibre-gl/)

There you can find a `CHANGELOG`
* [https://unpkg.com/browse/maplibre-gl@1.14.0/CHANGELOG.md](https://unpkg.com/browse/maplibre-gl@1.14.0/CHANGELOG.md)

## Query Parameters

`?meta`
    Return metadata about any file in a package as JSON (e.g.`/dist/maplibre-gl.js?meta`)

* [https://unpkg.com/maplibre-gl@1.14.0/dist/maplibre-gl.js?meta](https://unpkg.com/maplibre-gl@1.14.0/dist/maplibre-gl.js?meta)

Example output gives the `lastModified` & `size` metadata.

```javascript
{
  "path": "/dist/maplibre-gl.js",
  "type": "file",
  "contentType": "application/javascript",
  "integrity": "sha384-jWZKsznBFj0Nl3kUaRKmmk89Hew9zDhTnmOz0pOLceWY7iag+l/8QNPeD0cQYaVG",
  "lastModified": "Wed, 24 Mar 2021 19:28:04 GMT",
  "size": 766872
}
```
