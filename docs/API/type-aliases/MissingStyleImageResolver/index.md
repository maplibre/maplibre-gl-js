# MissingStyleImageResolver

> **MissingStyleImageResolver** = (`id`: `string`) =\> `void` | `Promise`\<`void`\>

Defined in: [ui/map.ts:492](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/map.ts#L492>)

Callback used by [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#setmissingstyleimageresolver>) to resolve missing style images, typically by calling [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#addimage>). MapLibre awaits the returned promise before treating the image as missing.

## Parameters

| Parameter | Type |
| --- | --- |
| `id` | `string` |

## Returns

`void` | `Promise`\<`void`\>
