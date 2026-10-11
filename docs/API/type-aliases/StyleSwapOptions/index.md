# StyleSwapOptions

> **StyleSwapOptions** = `object`

Defined in: [style/style.ts:190](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L190>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### diff?

> `optional` **diff?**: `boolean`

Defined in: [style/style.ts:195](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L195>)

If false, force a 'full' update, removing the current style and building the given one instead of attempting a diff-based update.

---

### transformStyle?

> `optional` **transformStyle?**: [`TransformStyleFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>)

Defined in: [style/style.ts:200](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L200>)

TransformStyleFunction is a convenience function that allows to modify a style after it is fetched but before it is committed to the map state. Refer to [TransformStyleFunction](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>).
