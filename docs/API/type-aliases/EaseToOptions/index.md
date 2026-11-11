# EaseToOptions

> **EaseToOptions** = [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) &amp; [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>) &amp; `object`

Defined in: [ui/camera.ts:236](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/camera.ts#L236>)

The [Map.easeTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#easeto>) options object

## Type Declaration

### around?

> `optional` **around?**: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)

If `zoom` is specified, `around` determines the point around which the zoom is centered.

### \~\~delayEndEvents?\~\~

> `optional` **delayEndEvents?**: `number`

#### Deprecated

Has no effect, and will be removed in the next major version.

### padding?

> `optional` **padding?**: `number` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

Dimensions in pixels applied on each side of the viewport for shifting the vanishing point, which the transition animates to. The map keeps this padding once the transition ends.
