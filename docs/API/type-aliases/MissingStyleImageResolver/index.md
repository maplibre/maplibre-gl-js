# MissingStyleImageResolver

> **MissingStyleImageResolver** = (`id`: `string`) =\> `void` | `Promise`\<`void`\>

Defined in: [ui/map.ts:479](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/map.ts#L479>)

Callback used by [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>) to resolve missing style images, typically by calling [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage>). MapLibre awaits the returned promise before treating the image as missing.

## Parameters

| Parameter | Type |
| --- | --- |
| `id` | `string` |

## Returns

`void` | `Promise`\<`void`\>
