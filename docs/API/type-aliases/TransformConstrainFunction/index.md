# TransformConstrainFunction

> **TransformConstrainFunction** = (`lngLat`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>), `zoom`: `number`) =\> `object`

Defined in: [camera/camera\_types.ts:9](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/camera/camera_types.ts#L9>)

The callback defining how the camera constrains the viewport's lnglat and zoom to respect the longitude and latitude bounds.

## Parameters

| Parameter | Type |
| --- | --- |
| `lngLat` | [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) |
| `zoom` | `number` |

## Returns

`object`

### center

> **center**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

### zoom

> **zoom**: `number`

## See

[Customize the map transform constrain](<https://maplibre.org/maplibre-gl-js/docs/examples/customize-the-map-transform-constrain/>)
