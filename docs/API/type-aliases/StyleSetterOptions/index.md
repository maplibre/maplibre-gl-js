# StyleSetterOptions

> **StyleSetterOptions** = `object`

Defined in: [style/style.ts:119](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/style/style.ts#L119>)

Supporting type to add validation to another style related type

## Properties

### globalState?

> `optional` **globalState?**: `Record`\<`string`, `any`\>

Defined in: [style/style.ts:127](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/style/style.ts#L127>)

Defines an initial global state for the map style. It overrides the defaults defined in the map style, as if [Map.setGlobalStateProperty](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setglobalstateproperty>) was called after loading the style.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:123](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/style/style.ts#L123>)

Whether to check if the filter conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
