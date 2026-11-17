# MarkerOptions

> **MarkerOptions** = `object`

Defined in: [ui/marker.ts:105](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L105>)

The [Marker](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/index.md>) options object

## Properties

### anchor?

> `optional` **anchor?**: [`PositionAnchor`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PositionAnchor/index.md>)

Defined in: [ui/marker.ts:123](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L123>)

A string indicating the part of the Marker that should be positioned closest to the coordinate set via [Marker.setLngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/index.md#setlnglat>). Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`.

#### Default Value

```ts
'center'
```

---

### className?

> `optional` **className?**: `string`

Defined in: [ui/marker.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L113>)

Space-separated CSS class names to add to marker element.

---

### clickTolerance?

> `optional` **clickTolerance?**: `number`

Defined in: [ui/marker.ts:147](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L147>)

The max number of pixels a user can shift the mouse pointer during a click on the marker for it to be considered a valid click (as opposed to a marker drag). The default is to inherit map's clickTolerance.

#### Default Value

```ts
0
```

---

### color?

> `optional` **color?**: `string`

Defined in: [ui/marker.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L128>)

The color to use for the default marker if options.element is not provided. The default is light blue.

#### Default Value

```ts
'#3FB1CE'
```

---

### draggable?

> `optional` **draggable?**: `boolean`

Defined in: [ui/marker.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L142>)

A boolean indicating whether or not a marker is able to be dragged to a new position on the map. A draggable default marker also becomes keyboard focusable and, while focused, moves by 1 screen pixel per arrow-key press (10 with Shift), firing the same `dragstart`/`drag`/`dragend` events as pointer dragging. Markers with a custom `element` keep their focusability and keyboard behavior application-owned.

#### Default Value

```ts
false
```

---

### element?

> `optional` **element?**: `HTMLElement`

Defined in: [ui/marker.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L109>)

DOM element to use as a marker. The default is a light blue, droplet-shaped SVG marker.

---

### offset?

> `optional` **offset?**: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)

Defined in: [ui/marker.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L117>)

The offset in pixels as a [PointLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) object to apply relative to the element's center. Negatives indicate left and up.

---

### opacity?

> `optional` **opacity?**: `string` | `number`

Defined in: [ui/marker.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L168>)

Marker's opacity when it's in clear view (not behind 3d terrain) Accepts any valid CSS opacity value as a number or string.

#### Default Value

```ts
1
```

---

### opacityWhenCovered?

> `optional` **opacityWhenCovered?**: `string` | `number`

Defined in: [ui/marker.ts:174](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L174>)

Marker's opacity when it's behind 3d terrain Accepts any valid CSS opacity value as a number or string.

#### Default Value

```ts
0.2
```

---

### pitchAlignment?

> `optional` **pitchAlignment?**: [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

Defined in: [ui/marker.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L162>)

`map` aligns the `Marker` to the plane of the map. `viewport` aligns the `Marker` to the plane of the viewport. `auto` automatically matches the value of `rotationAlignment`.

#### Default Value

```ts
'auto'
```

---

### rotation?

> `optional` **rotation?**: `number`

Defined in: [ui/marker.ts:152](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L152>)

The rotation angle of the marker in degrees, relative to its respective `rotationAlignment` setting. A positive value will rotate the marker clockwise.

#### Default Value

```ts
0
```

---

### rotationAlignment?

> `optional` **rotationAlignment?**: [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

Defined in: [ui/marker.ts:157](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L157>)

`map` aligns the `Marker`'s rotation relative to the map, maintaining a bearing as the map rotates. `viewport` aligns the `Marker`'s rotation relative to the viewport, agnostic to map rotations. `auto` is equivalent to `viewport`.

#### Default Value

```ts
'auto'
```

---

### scale?

> `optional` **scale?**: `number`

Defined in: [ui/marker.ts:133](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L133>)

The scale to use for the default marker if options.element is not provided. The default scale corresponds to a height of `41px` and a width of `27px`.

#### Default Value

```ts
1
```

---

### subpixelPositioning?

> `optional` **subpixelPositioning?**: `boolean`

Defined in: [ui/marker.ts:180](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/marker.ts#L180>)

If `true`, rounding is disabled for placement of the marker, allowing for subpixel positioning and smoother movement when the marker is translated.

#### Default Value

```ts
false
```
