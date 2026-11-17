# StyleSetterOptions

> **StyleSetterOptions** = `object`

Defined in: [style/style.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L120>)

Supporting type to add validation to another style related type

## Properties

### globalState?

> `optional` **globalState?**: `Record`\<`string`, `any`\>

Defined in: [style/style.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L128>)

Defines an initial global state for the map style. It overrides the defaults defined in the map style, as if [Map.setGlobalStateProperty](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#setglobalstateproperty>) was called after loading the style.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:124](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L124>)

Whether to check if the filter conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
