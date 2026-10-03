# UnwrappedTileIDLiteral

> **UnwrappedTileIDLiteral** = `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:12](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L12>)

Type for an object literal that specifies a map tile.

## Properties

### canonical

> **canonical**: `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:22](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L22>)

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

Defined in: [style/style\_layer/custom\_style\_layer.ts:18](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_layer/custom_style_layer.ts#L18>)

An optional wrap values. Useful in scenarios when multiple world copies are visible, such as a zoomed out map or a map centered around the antimeridian. Tiles from each world copy should have different wrap values, with wrap increasing for each copy from west to east.
