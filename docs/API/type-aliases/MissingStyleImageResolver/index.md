# MissingStyleImageResolver

> **MissingStyleImageResolver** = (`id`: `string`) =\> `void` | `Promise`\<`void`\>

Defined in: [ui/map.ts:483](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/map.ts#L483>)

Callback used by [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>) to resolve missing style images, typically by calling [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage>). MapLibre awaits the returned promise before treating the image as missing.

## Parameters

| Parameter | Type |
| --- | --- |
| `id` | `string` |

## Returns

`void` | `Promise`\<`void`\>
