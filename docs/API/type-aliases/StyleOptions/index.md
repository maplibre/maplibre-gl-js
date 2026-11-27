# StyleOptions

> **StyleOptions** = `object`

Defined in: [style/style.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L98>)

The options object related to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)'s style related methods

## Properties

### globalState?

> `optional` **globalState?**: `Record`\<`string`, `any`\>

Defined in: [style/style.ts:114](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L114>)

Defines an initial global state for the map style. It overrides the defaults defined in the map style, as if [Map.setGlobalStateProperty](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#setglobalstateproperty>) was called after loading the style.

---

### localIdeographFontFamily?

> `optional` **localIdeographFontFamily?**: `string` | `false`

Defined in: [style/style.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L110>)

Defines a CSS font-family fallback used only for locally generated CJK (Chinese, Japanese and Korean) characters. The layer's `text-font` families are tried first, then this family, then `sans-serif`. Set to `false` or an empty string to disable this fallback. Clusters and styles without a `glyphs` URL can still render locally. Changing this option forces a full style update.

---

### validate?

> `optional` **validate?**: `boolean`

Defined in: [style/style.ts:102](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L102>)

If false, style validation will be skipped. Useful in production environment.
