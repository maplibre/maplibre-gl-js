# TransformConstrainFunction

> **TransformConstrainFunction** = (`lngLat`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>), `zoom`: `number`) =\> `object`

Defined in: [geo/transform\_interface.ts:82](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/geo/transform_interface.ts#L82>)

The callback defining how the transform constrains the viewport's lnglat and zoom to respect the longitude and latitude bounds.

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
