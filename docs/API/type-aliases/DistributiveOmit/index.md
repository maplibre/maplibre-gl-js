# DistributiveOmit\<T, K *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\>

> **DistributiveOmit**\<`T`, `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\>\> = `T` *extends* `unknown` ? `Omit`\<`T`, `K`\> : `never`

Defined in: [util/vectortile\_to\_geojson.ts:15](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/vectortile_to_geojson.ts#L15>)

A helper for type to omit a property from a type

## Type Parameters

| Type Parameter |
| --- |
| `T` |
| `K` *extends* [`DistributiveKeys`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DistributiveKeys/index.md>)\<`T`\> |
