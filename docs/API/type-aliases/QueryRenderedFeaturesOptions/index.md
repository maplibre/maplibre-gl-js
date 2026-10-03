# QueryRenderedFeaturesOptions

> **QueryRenderedFeaturesOptions** = `object`

Defined in: [source/query\_features.ts:22](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L22>)

Options to pass to query the map for the rendered features

## Properties

### availableImages?

> `optional` **availableImages?**: `string`\[\]

Defined in: [source/query\_features.ts:35](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L35>)

An array of string representing the available images

---

### filter?

> `optional` **filter?**: `FilterSpecification`

Defined in: [source/query\_features.ts:31](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L31>)

A [filter](<https://maplibre.org/maplibre-style-spec/layers/#filter>) to limit query results.

---

### layers?

> `optional` **layers?**: `string`\[\] | `Set`\<`string`\>

Defined in: [source/query\_features.ts:27](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L27>)

An array or set of [style layer IDs](<https://maplibre.org/maplibre-style-spec/#layer-id>) for the query to inspect. Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [source/query\_features.ts:39](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L39>)

Whether to check if the `options.filter` conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
