# StyleOptions

> **StyleOptions** = `object`

Defined in: [style/style.ts:97](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L97>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### globalState?

> `optional` **globalState?**: `Record`\<`string`, `any`\>

Defined in: [style/style.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L113>)

Defines an initial global state for the map style. It overrides the defaults defined in the map style, as if [Map.setGlobalStateProperty](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setglobalstateproperty>) was called after loading the style.

---

### localIdeographFontFamily?

> `optional` **localIdeographFontFamily?**: `string` | `false`

Defined in: [style/style.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L109>)

Defines a CSS font-family for locally overriding generation of Chinese, Japanese, and Korean characters. For these characters, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold). Set to `false`, to enable font settings from the map's style for these glyph ranges. Forces a full update.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:101](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L101>)

If false, style validation will be skipped. Useful in production environment.
