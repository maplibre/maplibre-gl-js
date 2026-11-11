# QueryRenderedFeaturesOptions

> **QueryRenderedFeaturesOptions** = `object`

Defined in: [source/query\_features.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/query_features.ts#L21>)

Options to pass to query the map for the rendered features

## Properties

### availableImages?

> `optional` **availableImages?**: `string`\[\]

Defined in: [source/query\_features.ts:34](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/query_features.ts#L34>)

An array of string representing the available images

---

### filter?

> `optional` **filter?**: `FilterSpecification`

Defined in: [source/query\_features.ts:30](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/query_features.ts#L30>)

A [filter](<https://maplibre.org/maplibre-style-spec/layers/#filter>) to limit query results.

---

### layers?

> `optional` **layers?**: `string`\[\] | `Set`\<`string`\>

Defined in: [source/query\_features.ts:26](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/query_features.ts#L26>)

An array or set of [style layer IDs](<https://maplibre.org/maplibre-style-spec/#layer-id>) for the query to inspect. Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [source/query\_features.ts:38](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/query_features.ts#L38>)

Whether to check if the `options.filter` conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
