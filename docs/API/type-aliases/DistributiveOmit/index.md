# DistributiveOmit\<T, K *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\>

> **DistributiveOmit**\<`T`, `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\> = `T` *extends* `unknown` ? `Omit`\<`T`, `K`\> : `never`

Defined in: [util/vectortile\_to\_geojson.ts:17](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/vectortile_to_geojson.ts#L17>)

A helper for type to omit a property from a type

## Type Parameters

| Type Parameter |
| --- |
| `T` |
| `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\> |
