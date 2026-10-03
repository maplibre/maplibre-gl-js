# QuerySourceFeatureOptions

> **QuerySourceFeatureOptions** = `object`

Defined in: [source/query\_features.ts:54](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L54>)

The options object related to the [Map.querySourceFeatures](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#querysourcefeatures>) method

## Properties

### filter?

> `optional` **filter?**: `FilterSpecification`

Defined in: [source/query\_features.ts:63](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L63>)

A [filter](<https://maplibre.org/maplibre-style-spec/layers/#filter>) to limit query results.

---

### sourceLayer?

> `optional` **sourceLayer?**: `string`

Defined in: [source/query\_features.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L58>)

The name of the source layer to query. *For vector tile sources, this parameter is required.* For GeoJSON sources, it is ignored.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [source/query\_features.ts:68](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/query_features.ts#L68>)

Whether to check if the `parameters.filter` conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.

#### Default Value

```ts
true
```
