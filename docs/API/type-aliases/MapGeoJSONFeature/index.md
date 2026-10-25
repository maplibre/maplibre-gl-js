# MapGeoJSONFeature

> **MapGeoJSONFeature** = [`GeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GeoJSONFeature/index.md>) &amp; `object`

Defined in: [util/vectortile\_to\_geojson.ts:24](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/vectortile_to_geojson.ts#L24>)

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
