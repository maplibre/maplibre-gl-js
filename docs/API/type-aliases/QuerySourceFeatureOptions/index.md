# QuerySourceFeatureOptions

> **QuerySourceFeatureOptions** = `object`

Defined in: [source/query\_features.ts:55](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/source/query_features.ts#L55>)

The options object related to the [Map.querySourceFeatures](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#querysourcefeatures>) method

## Properties

### filter?

> `optional` **filter?**: `FilterSpecification`

Defined in: [source/query\_features.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/source/query_features.ts#L64>)

A [filter](<https://maplibre.org/maplibre-style-spec/layers/#filter>) to limit query results.

---

### sourceLayer?

> `optional` **sourceLayer?**: `string`

Defined in: [source/query\_features.ts:59](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/source/query_features.ts#L59>)

The name of the source layer to query. *For vector tile sources, this parameter is required.* For GeoJSON sources, it is ignored.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [source/query\_features.ts:69](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/source/query_features.ts#L69>)

Whether to check if the `parameters.filter` conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.

#### Default Value

```ts
true
```
