# StyleOptions

> **StyleOptions** = `object`

Defined in: [style/style.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L98>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### globalState?

> `optional` **globalState?**: `Record`\<`string`, `any`\>

Defined in: [style/style.ts:114](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L114>)

Defines an initial global state for the map style. It overrides the defaults defined in the map style, as if [Map.setGlobalStateProperty](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#setglobalstateproperty>) was called after loading the style.

---

### localIdeographFontFamily?

> `optional` **localIdeographFontFamily?**: `string` | `false`

Defined in: [style/style.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L110>)

Defines a CSS font-family for locally overriding generation of Chinese, Japanese, and Korean characters. For these characters, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold). Set to `false`, to enable font settings from the map's style for these glyph ranges. Forces a full update.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:102](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/style/style.ts#L102>)

If false, style validation will be skipped. Useful in production environment.
