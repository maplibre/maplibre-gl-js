# DistributiveOmit\<T, K *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\>

> **DistributiveOmit**\<`T`, `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\> = `T` *extends* `unknown` ? `Omit`\<`T`, `K`\> : `never`

Defined in: [util/vectortile\_to\_geojson.ts:17](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/vectortile_to_geojson.ts#L17>)

A helper for type to omit a property from a type

## Type Parameters

| Type Parameter |
| --- |
| `T` |
| `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\> |
