# ProjectionDataParams

> **ProjectionDataParams** = `object`

Defined in: [geo/projection/projection\_data.ts:92](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L92>)

Parameters object for `getProjectionData` in `camera_math.ts`. Contains the requested tile ID and more.

## Properties

### aligned?

> `optional` **aligned?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L100>)

Set to true if a pixel-aligned matrix should be used, if possible (mostly used for raster tiles under mercator projection)

---

### applyGlobeMatrix?

> `optional` **applyGlobeMatrix?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:108](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L108>)

Set to true if the globe matrix should be applied (i.e. when rendering globe)

---

### applyTerrainMatrix?

> `optional` **applyTerrainMatrix?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:104](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L104>)

Set to true if the terrain matrix should be applied (i.e. when rendering terrain)

---

### overscaledTileID

> **overscaledTileID**: [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>) | `null`

Defined in: [geo/projection/projection\_data.ts:96](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L96>)

The ID of the current tile
