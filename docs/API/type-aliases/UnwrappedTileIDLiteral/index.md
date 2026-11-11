# UnwrappedTileIDLiteral

> **UnwrappedTileIDLiteral** = `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:13](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/style/style_layer/custom_style_layer.ts#L13>)

Type for an object literal that specifies a map tile.

## Properties

### canonical

> **canonical**: `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:23](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/style/style_layer/custom_style_layer.ts#L23>)

The tile's XY coordinates and zoom level.

#### x

> **x**: `number`

#### y

> **y**: `number`

#### z

> **z**: `number`

---

### wrap?

> `optional` **wrap?**: `number`

Defined in: [style/style\_layer/custom\_style\_layer.ts:19](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/style/style_layer/custom_style_layer.ts#L19>)

An optional wrap values. Useful in scenarios when multiple world copies are visible, such as a zoomed out map or a map centered around the antimeridian. Tiles from each world copy should have different wrap values, with wrap increasing for each copy from west to east.
