# CustomLayerProjectionDataParams

> **CustomLayerProjectionDataParams** = `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L33>)

Parameters object for the [CustomRenderMethodInput.getProjectionData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/#getprojectiondata>) function. Contains the requested tile ID and more.

## Properties

### aligned?

> `optional` **aligned?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:42](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L42>)

Set to true if a pixel-aligned matrix should be used, if possible. This flag is mostly used for raster tiles under mercator projection.

---

### applyGlobeMatrix?

> `optional` **applyGlobeMatrix?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:50](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L50>)

Set to true if the globe matrix should be applied when using globe projection.

---

### applyTerrainMatrix?

> `optional` **applyTerrainMatrix?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:46](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L46>)

Set to true if the terrain matrix should be applied when pre-rendering tiles into textures for 3D terrain.

---

### tileID

> **tileID**: [`UnwrappedTileIDLiteral`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UnwrappedTileIDLiteral/index.md>) | `null`

Defined in: [style/style\_layer/custom\_style\_layer.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L37>)

The coordinates of the current tile.
