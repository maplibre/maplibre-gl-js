# GeoJSONFeatureDiff

> **GeoJSONFeatureDiff** = `object`

Defined in: [source/geojson\_source\_diff.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L33>)

A geojson feature diff object - processed in the following order: new geometry, remove properties, add/update properties. Provides an efficient way to update GeoJSON features in a map source without replacing the entire feature.

## Properties

### addOrUpdateProperties?

> `optional` **addOrUpdateProperties?**: `object`\[\]

Defined in: [source/geojson\_source\_diff.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L53>)

The properties to add or update along side their values

#### key

> **key**: `string`

#### value

> **value**: `any`

---

### id

> **id**: [`GeoJSONFeatureId`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeoJSONFeatureId/index.md>)

Defined in: [source/geojson\_source\_diff.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L37>)

The feature ID

---

### newGeometry?

> `optional` **newGeometry?**: `GeoJSON.Geometry`

Defined in: [source/geojson\_source\_diff.ts:41](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L41>)

If it's a new geometry, place it here

---

### removeAllProperties?

> `optional` **removeAllProperties?**: `boolean`

Defined in: [source/geojson\_source\_diff.ts:45](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L45>)

Setting to `true` will remove all preperties

---

### removeProperties?

> `optional` **removeProperties?**: `string`\[\]

Defined in: [source/geojson\_source\_diff.ts:49](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source_diff.ts#L49>)

The properties keys to remove
