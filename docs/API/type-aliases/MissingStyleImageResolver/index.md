# MissingStyleImageResolver

> **MissingStyleImageResolver** = (`id`: `string`) =\> `void` | `Promise`\<`void`\>

Defined in: [ui/map.ts:469](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/ui/map.ts#L469>)

Callback used by [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>) to resolve missing style images, typically by calling [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage>). MapLibre awaits the returned promise before treating the image as missing.

## Parameters

| Parameter | Type |
| --- | --- |
| `id` | `string` |

## Returns

`void` | `Promise`\<`void`\>
