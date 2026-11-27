# QueryRenderedFeaturesOptions

> **QueryRenderedFeaturesOptions** = `object`

Defined in: [source/query\_features.ts:23](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/source/query_features.ts#L23>)

Options to pass to query the map for the rendered features

## Properties

### availableImages?

> `optional` **availableImages?**: `string`\[\]

Defined in: [source/query\_features.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/source/query_features.ts#L36>)

An array of string representing the available images

---

### filter?

> `optional` **filter?**: `FilterSpecification`

Defined in: [source/query\_features.ts:32](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/source/query_features.ts#L32>)

A [filter](<https://maplibre.org/maplibre-style-spec/layers/#filter>) to limit query results.

---

### layers?

> `optional` **layers?**: `string`\[\] | `Set`\<`string`\>

Defined in: [source/query\_features.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/source/query_features.ts#L28>)

An array or set of [style layer IDs](<https://maplibre.org/maplibre-style-spec/#layer-id>) for the query to inspect. Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [source/query\_features.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/source/query_features.ts#L40>)

Whether to check if the `options.filter` conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
