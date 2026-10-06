# StyleSetterOptions

> **StyleSetterOptions** = `object`

Defined in: [style/style.ts:115](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L115>)

Supporting type to add validation to another style related type

## Properties

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:119](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L119>)

Whether to check if the filter conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
