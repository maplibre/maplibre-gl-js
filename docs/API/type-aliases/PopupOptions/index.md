# PopupOptions

> **PopupOptions** = `object`

Defined in: [ui/popup.ts:44](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L44>)

The [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) options object

## Properties

### anchor?

> `optional` **anchor?**: [`PositionAnchor`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PositionAnchor/index.md>)

Defined in: [ui/popup.ts:73](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L73>)

A string indicating the part of the Popup that should be positioned closest to the coordinate set via [Popup.setLngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md#setlnglat>). Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset the anchor will be dynamically set to ensure the popup falls within the map container with a preference for `'bottom'`.

---

### className?

> `optional` **className?**: `string`

Defined in: [ui/popup.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L81>)

Space-separated CSS class names to add to popup container

---

### closeButton?

> `optional` **closeButton?**: `boolean`

Defined in: [ui/popup.ts:49](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L49>)

If `true`, a close button will appear in the top right corner of the popup.

#### Default Value

```ts
true
```

---

### closeOnClick?

> `optional` **closeOnClick?**: `boolean`

Defined in: [ui/popup.ts:54](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L54>)

If `true`, the popup will closed when the map is clicked.

#### Default Value

```ts
true
```

---

### closeOnMove?

> `optional` **closeOnMove?**: `boolean`

Defined in: [ui/popup.ts:59](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L59>)

If `true`, the popup will closed when the map moves.

#### Default Value

```ts
false
```

---

### focusAfterOpen?

> `optional` **focusAfterOpen?**: `boolean`

Defined in: [ui/popup.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L64>)

If `true`, the popup will try to focus the first focusable element inside the popup.

#### Default Value

```ts
true
```

---

### locationOccludedOpacity?

> `optional` **locationOccludedOpacity?**: `number` | `string`

Defined in: [ui/popup.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L100>)

Optional opacity when the location is behind the globe. Note that if a number is provided, it will be converted to a string.

#### Default Value

```ts
undefined
```

---

### maxWidth?

> `optional` **maxWidth?**: `string`

Defined in: [ui/popup.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L88>)

A string that sets the CSS property of the popup's maximum width, eg `'300px'`. To ensure the popup resizes to fit its content, set this property to `'none'`. Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width

#### Default Value

```ts
'240px'
```

---

### offset?

> `optional` **offset?**: [`Offset`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Offset/index.md>)

Defined in: [ui/popup.ts:77](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L77>)

A pixel offset applied to the popup's location

---

### padding?

> `optional` **padding?**: [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

Defined in: [ui/popup.ts:107](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L107>)

A pixel padding applied to the popup's positioning constraints. The popup will be positioned to avoid being placed within this padding area from the edges of the map container.

#### Default Value

```ts
undefined
```

---

### subpixelPositioning?

> `optional` **subpixelPositioning?**: `boolean`

Defined in: [ui/popup.ts:94](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/popup.ts#L94>)

If `true`, rounding is disabled for placement of the popup, allowing for subpixel positioning and smoother movement when the popup is translated.

#### Default Value

```ts
false
```
