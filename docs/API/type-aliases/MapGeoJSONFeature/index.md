# MapGeoJSONFeature

> **MapGeoJSONFeature** = [`GeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GeoJSONFeature/index.md>) & `object`

Defined in: [util/vectortile\_to\_geojson.ts:24](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/vectortile_to_geojson.ts#L24>)

An extended geojson feature used by the events to return data to the listener

## Type Declaration

### layer

> **layer**: [`DistributiveOmit`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveOmit/index.md>)\<[`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>), `"source"`\> & `object`

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
