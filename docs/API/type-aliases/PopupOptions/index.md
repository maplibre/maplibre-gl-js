# PopupOptions

> **PopupOptions** = `object`

Defined in: [ui/popup.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L43>)

The [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) options object

## Properties

### anchor?

> `optional` **anchor?**: [`PositionAnchor`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PositionAnchor/index.md>)

Defined in: [ui/popup.ts:72](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L72>)

A string indicating the part of the Popup that should be positioned closest to the coordinate set via [Popup.setLngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/#setlnglat>). Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset the anchor will be dynamically set to ensure the popup falls within the map container with a preference for `'bottom'`.

---

### className?

> `optional` **className?**: `string`

Defined in: [ui/popup.ts:80](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L80>)

Space-separated CSS class names to add to popup container

---

### closeButton?

> `optional` **closeButton?**: `boolean`

Defined in: [ui/popup.ts:48](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L48>)

If `true`, a close button will appear in the top right corner of the popup.

#### Default Value

```ts
true
```

---

### closeOnClick?

> `optional` **closeOnClick?**: `boolean`

Defined in: [ui/popup.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L53>)

If `true`, the popup will closed when the map is clicked.

#### Default Value

```ts
true
```

---

### closeOnMove?

> `optional` **closeOnMove?**: `boolean`

Defined in: [ui/popup.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L58>)

If `true`, the popup will closed when the map moves.

#### Default Value

```ts
false
```

---

### focusAfterOpen?

> `optional` **focusAfterOpen?**: `boolean`

Defined in: [ui/popup.ts:63](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L63>)

If `true`, the popup will try to focus the first focusable element inside the popup.

#### Default Value

```ts
true
```

---

### locationOccludedOpacity?

> `optional` **locationOccludedOpacity?**: `number` | `string`

Defined in: [ui/popup.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L99>)

Optional opacity when the location is behind the globe. Note that if a number is provided, it will be converted to a string.

#### Default Value

```ts
undefined
```

---

### maxWidth?

> `optional` **maxWidth?**: `string`

Defined in: [ui/popup.ts:87](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L87>)

A string that sets the CSS property of the popup's maximum width, eg `'300px'`. To ensure the popup resizes to fit its content, set this property to `'none'`. Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width

#### Default Value

```ts
'240px'
```

---

### offset?

> `optional` **offset?**: [`Offset`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Offset/index.md>)

Defined in: [ui/popup.ts:76](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L76>)

A pixel offset applied to the popup's location

---

### padding?

> `optional` **padding?**: [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

Defined in: [ui/popup.ts:106](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L106>)

A pixel padding applied to the popup's positioning constraints. The popup will be positioned to avoid being placed within this padding area from the edges of the map container.

#### Default Value

```ts
undefined
```

---

### subpixelPositioning?

> `optional` **subpixelPositioning?**: `boolean`

Defined in: [ui/popup.ts:93](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/popup.ts#L93>)

If `true`, rounding is disabled for placement of the popup, allowing for subpixel positioning and smoother movement when the popup is translated.

#### Default Value

```ts
false
```
