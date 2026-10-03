# StyleSetterOptions

> **StyleSetterOptions** = `object`

Defined in: [style/style.ts:115](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style.ts#L115>)

Supporting type to add validation to another style related type

## Properties

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:119](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style.ts#L119>)

Whether to check if the filter conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
