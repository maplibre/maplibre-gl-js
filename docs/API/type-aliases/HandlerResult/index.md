# HandlerResult

> **HandlerResult** = `object`

Defined in: [ui/handler\_manager.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L113>)

All handler methods that are called with events can optionally return a `HandlerResult`.

## Properties

### around?

> `optional` **around?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L122>)

the point to not move when changing the camera

---

### cameraAnimation?

> `optional` **cameraAnimation?**: (`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)) =\> `void`

Defined in: [ui/handler\_manager.ts:130](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L130>)

A method that can fire a one-off easing by directly changing the map's camera.

#### Parameters

| Parameter | Type |
| --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) |

#### Returns

`void`

---

### needsRenderFrame?

> `optional` **needsRenderFrame?**: `boolean`

Defined in: [ui/handler\_manager.ts:139](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L139>)

Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).

---

### noInertia?

> `optional` **noInertia?**: `boolean`

Defined in: [ui/handler\_manager.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L143>)

The camera changes won't get recorded for inertial zooming.

---

### originalEvent?

> `optional` **originalEvent?**: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

Defined in: [ui/handler\_manager.ts:135](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L135>)

The last three properties are needed by only one handler: scrollzoom. The DOM event to be used as the `originalEvent` on any camera change events.

---

### pinchAround?

> `optional` **pinchAround?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:126](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L126>)

same as above, except for pinch actions, which are given higher priority
