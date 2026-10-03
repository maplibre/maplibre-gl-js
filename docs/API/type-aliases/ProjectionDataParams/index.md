# ProjectionDataParams

> **ProjectionDataParams** = `object`

Defined in: [geo/projection/projection\_data.ts:80](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L80>)

Parameters object for the transform's `getProjectionData` function. Contains the requested tile ID and more.

## Properties

### aligned?

> `optional` **aligned?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L88>)

Set to true if a pixel-aligned matrix should be used, if possible (mostly used for raster tiles under mercator projection)

---

### applyGlobeMatrix?

> `optional` **applyGlobeMatrix?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:96](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L96>)

Set to true if the globe matrix should be applied (i.e. when rendering globe)

---

### applyTerrainMatrix?

> `optional` **applyTerrainMatrix?**: `boolean`

Defined in: [geo/projection/projection\_data.ts:92](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L92>)

Set to true if the terrain matrix should be applied (i.e. when rendering terrain)

---

### overscaledTileID

> **overscaledTileID**: [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>) | `null`

Defined in: [geo/projection/projection\_data.ts:84](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L84>)

The ID of the current tile
