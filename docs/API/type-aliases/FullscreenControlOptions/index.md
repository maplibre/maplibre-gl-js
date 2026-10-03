# FullscreenControlOptions

> **FullscreenControlOptions** = `object`

Defined in: [ui/control/fullscreen\_control.ts:11](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/fullscreen_control.ts#L11>)

The [FullscreenControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenControl/index.md>) options object

## Properties

### container?

> `optional` **container?**: `HTMLElement`

Defined in: [ui/control/fullscreen\_control.ts:15](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/fullscreen_control.ts#L15>)

`container` is the [compatible DOM element](<https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#Compatible_elements>) which should be made full screen. By default, the map container element will be made full screen.

---

### pseudo?

> `optional` **pseudo?**: `boolean`

Defined in: [ui/control/fullscreen\_control.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/fullscreen_control.ts#L21>)

If `true`, the fullscreen control will always use pseudo fullscreen mode (CSS-based, expanding to browser viewport) instead of native fullscreen API. This can be useful for faster transitions and to allow multiple maps to be "fullscreen" simultaneously in different browser windows.

#### Default Value

```ts
false
```
