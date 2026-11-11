# CameraUpdateTransformFunction

> **CameraUpdateTransformFunction** = (`next`: `object`) =\> `object`

Defined in: [ui/camera.ts:335](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/camera.ts#L335>)

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
