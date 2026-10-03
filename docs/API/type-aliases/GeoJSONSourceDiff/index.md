# GeoJSONSourceDiff

> **GeoJSONSourceDiff** = `object`

Defined in: [source/geojson\_source\_diff.ts:10](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/geojson_source_diff.ts#L10>)

The geojson source diff object - processed in the following order: remove, add, update. Provides an efficient way to update GeoJSON data in a map source without having to replace the entire dataset.

## Properties

### add?

> `optional` **add?**: `GeoJSON.Feature`\[\]

Defined in: [source/geojson\_source\_diff.ts:22](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/geojson_source_diff.ts#L22>)

An array of features to add

---

### remove?

> `optional` **remove?**: [`GeoJSONFeatureId`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeoJSONFeatureId/index.md>)\[\]

Defined in: [source/geojson\_source\_diff.ts:18](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/geojson_source_diff.ts#L18>)

An array of features IDs to remove

---

### removeAll?

> `optional` **removeAll?**: `boolean`

Defined in: [source/geojson\_source\_diff.ts:14](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/geojson_source_diff.ts#L14>)

When set to `true` it will remove all features

---

### update?

> `optional` **update?**: [`GeoJSONFeatureDiff`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeoJSONFeatureDiff/index.md>)\[\]

Defined in: [source/geojson\_source\_diff.ts:26](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/geojson_source_diff.ts#L26>)

An array of update objects
