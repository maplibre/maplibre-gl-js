# MissingStyleImageResolver

> **MissingStyleImageResolver** = (`id`: `string`) =\> `void` | `Promise`\<`void`\>

Defined in: [ui/map.ts:486](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/map.ts#L486>)

Callback used by [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>) to resolve missing style images, typically by calling [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage>). MapLibre awaits the returned promise before treating the image as missing.

## Parameters

| Parameter | Type |
| --- | --- |
| `id` | `string` |

## Returns

`void` | `Promise`\<`void`\>
