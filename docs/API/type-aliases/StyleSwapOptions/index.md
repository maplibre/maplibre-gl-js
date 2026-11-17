# StyleSwapOptions

> **StyleSwapOptions** = `object`

Defined in: [style/style.ts:191](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L191>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### diff?

> `optional` **diff?**: `boolean`

Defined in: [style/style.ts:196](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L196>)

If false, force a 'full' update, removing the current style and building the given one instead of attempting a diff-based update.

---

### transformStyle?

> `optional` **transformStyle?**: [`TransformStyleFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>)

Defined in: [style/style.ts:201](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L201>)

TransformStyleFunction is a convenience function that allows to modify a style after it is fetched but before it is committed to the map state. Refer to [TransformStyleFunction](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>).
