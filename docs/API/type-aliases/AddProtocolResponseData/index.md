# AddProtocolResponseData

> **AddProtocolResponseData** = `ArrayBuffer` | `ImageBitmap` | `HTMLImageElement` | `string` | `object`

Defined in: [util/config.ts:13](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/config.ts#L13>)

The `data` a protocol handler resolves with. Which member is expected follows `RequestParameters.type`:

- `'arrayBuffer'`: an `ArrayBuffer`, for example a non-compressed pbf vector tile.
- `'json'`: the parsed JSON value.
- `'string'`: a string.
- `'image'`: an `ImageBitmap` or `HTMLImageElement`, used as is, or an `ArrayBuffer` of encoded image bytes, which are decoded first. A handler that already holds decoded pixels should return them as an `ImageBitmap`, since encoding them only makes the library decode them again.
