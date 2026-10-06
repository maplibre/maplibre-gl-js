# CustomLayerProjectionDataParams

> **CustomLayerProjectionDataParams** = `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:34](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L34>)

Parameters object for the [CustomRenderMethodInput.getProjectionData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/#getprojectiondata>) function. Contains the requested tile ID and more.

## Properties

### aligned?

> `optional` **aligned?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L43>)

Set to true if a pixel-aligned matrix should be used, if possible. This flag is mostly used for raster tiles under mercator projection.

---

### applyGlobeMatrix?

> `optional` **applyGlobeMatrix?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L51>)

Set to true if the globe matrix should be applied when using globe projection.

---

### applyTerrainMatrix?

> `optional` **applyTerrainMatrix?**: `boolean`

Defined in: [style/style\_layer/custom\_style\_layer.ts:47](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L47>)

Set to true if the terrain matrix should be applied when pre-rendering tiles into textures for 3D terrain.

---

### tileID

> **tileID**: [`UnwrappedTileIDLiteral`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UnwrappedTileIDLiteral/index.md>) | `null`

Defined in: [style/style\_layer/custom\_style\_layer.ts:38](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L38>)

The coordinates of the current tile.
