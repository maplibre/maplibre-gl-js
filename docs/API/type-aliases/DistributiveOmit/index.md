# DistributiveOmit\<T, K *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\>

> **DistributiveOmit**\<`T`, `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\> = `T` *extends* `unknown` ? `Omit`\<`T`, `K`\> : `never`

Defined in: [util/vectortile\_to\_geojson.ts:15](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/vectortile_to_geojson.ts#L15>)

A helper for type to omit a property from a type

## Type Parameters

| Type Parameter |
| --- |
| `T` |
| `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\> |
