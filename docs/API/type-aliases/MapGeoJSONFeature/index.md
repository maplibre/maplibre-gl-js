# MapGeoJSONFeature

> **MapGeoJSONFeature** = [`GeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GeoJSONFeature/index.md>) &amp; `object`

Defined in: [util/vectortile\_to\_geojson.ts:22](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/vectortile_to_geojson.ts#L22>)

An extended geojson feature used by the events to return data to the listener

## Type Declaration

### layer

> **layer**: [`DistributiveOmit`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveOmit/index.md>)\<[`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>), `"source"`\> &amp; `object`

#### Type Declaration

##### source

> **source**: `string`

### source

> **source**: `string`

### sourceLayer?

> `optional` **sourceLayer?**: `string`

### state

> **state**: `object`

#### Index Signature

\[`key`: `string`\]: `any`
