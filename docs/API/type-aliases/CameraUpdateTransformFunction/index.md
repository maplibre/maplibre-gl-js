# CameraUpdateTransformFunction

> **CameraUpdateTransformFunction** = (`next`: `object`) =\> `object`

Defined in: [ui/camera.ts:252](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/camera.ts#L252>)

A callback hook that allows manipulating the camera and being notified about camera updates before they happen

## Parameters

| Parameter | Type |
| --- | --- |
| `next` | { `bearing`: `number`; `center`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>); `elevation`: `number`; `pitch`: `number`; `roll`: `number`; `zoom`: `number`; } |
| `next.bearing` | `number` |
| `next.center` | [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) |
| `next.elevation` | `number` |
| `next.pitch` | `number` |
| `next.roll` | `number` |
| `next.zoom` | `number` |

## Returns

`object`

### bearing?

> `optional` **bearing?**: `number`

### center?

> `optional` **center?**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

### elevation?

> `optional` **elevation?**: `number`

### pitch?

> `optional` **pitch?**: `number`

### roll?

> `optional` **roll?**: `number`

### zoom?

> `optional` **zoom?**: `number`
