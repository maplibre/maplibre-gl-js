# DragRotateOptions

> **DragRotateOptions** = { `around?`: `"center"`; `movement?`: `"circular"` | `"linear"`; } | { `around`: `"pointer"`; }

Defined in: [ui/handler/shim/drag\_rotate.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/ui/handler/shim/drag_rotate.ts#L28>)

Options object for [DragRotateHandler.enable](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/#enable>). A drag around the pointer always turns the map linearly, so `movement` is only set with `around: 'center'`.

## Union Members

### Type Literal

{ `around?`: `"center"`; `movement?`: `"circular"` | `"linear"`; }

#### around?

> `optional` **around?**: `"center"`

The map turns and tilts around its center.

##### Default Value

```ts
'center'
```

#### movement?

> `optional` **movement?**: `"circular"` | `"linear"`

How a drag around the center turns the map. If `'circular'` is passed, the map follows the pointer around the center like a wheel, so the same drag turns it one way above the center and the other way below. If `'linear'` is passed, the bearing follows the horizontal movement of the pointer, the same way anywhere on the map.

##### Default Value

'circular', or 'linear' if [MapOptions.aroundCenter](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#aroundcenter>) is `false`

---

### Type Literal

{ `around`: `"pointer"`; }

#### around

> **around**: `"pointer"`

The map turns and tilts around the point under the pointer where the drag starts, on the terrain where there is any, which keeps its place on the screen and its distance from the camera, so tilting also zooms. The bearing follows the horizontal movement of the pointer. A drag that starts in the sky turns around the center.
