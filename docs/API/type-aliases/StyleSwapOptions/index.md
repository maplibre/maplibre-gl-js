# StyleSwapOptions

> **StyleSwapOptions** = `object`

Defined in: [style/style.ts:182](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L182>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### diff?

> `optional` **diff?**: `boolean`

Defined in: [style/style.ts:187](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L187>)

If false, force a 'full' update, removing the current style and building the given one instead of attempting a diff-based update.

---

### transformStyle?

> `optional` **transformStyle?**: [`TransformStyleFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>)

Defined in: [style/style.ts:192](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L192>)

TransformStyleFunction is a convenience function that allows to modify a style after it is fetched but before it is committed to the map state. Refer to [TransformStyleFunction](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformStyleFunction/index.md>).
