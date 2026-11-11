# HandlerResult

> **HandlerResult** = `object`

Defined in: [ui/handler\_manager.ts:111](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L111>)

All handler methods that are called with events can optionally return a `HandlerResult`.

## Properties

### around?

> `optional` **around?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L120>)

the point to not move when changing the camera

---

### easeTo?

> `optional` **easeTo?**: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>)

Defined in: [ui/handler\_manager.ts:130](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L130>)

A one-off easing of the camera, such as a double click's zoom, that ends the gesture: every handler is reset before it starts, so that the next frame of a handler does not stop it, and its events carry the input event that asked for it as `originalEvent`.

---

### needsRenderFrame?

> `optional` **needsRenderFrame?**: `boolean`

Defined in: [ui/handler\_manager.ts:145](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L145>)

Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).

---

### noInertia?

> `optional` **noInertia?**: `boolean`

Defined in: [ui/handler\_manager.ts:149](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L149>)

The camera changes won't get recorded for inertial zooming.

---

### originalEvent?

> `optional` **originalEvent?**: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

Defined in: [ui/handler\_manager.ts:141](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L141>)

The last three properties are needed by only one handler: scrollzoom. The DOM event to be used as the `originalEvent` on any camera change events.

---

### pinchAround?

> `optional` **pinchAround?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:124](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L124>)

same as above, except for pinch actions, which are given higher priority

---

### timeout?

> `optional` **timeout?**: `object`

Defined in: [ui/handler\_manager.ts:136](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L136>)

Asks the manager to call the handler's `onTimeout` with `token` after `delay` milliseconds, for a handler that waits for input that may not come, such as a wheel zoom telling a mouse wheel from a trackpad. The handler ignores a timeout whose token it no longer waits for, so it never needs to cancel one.

#### delay

> **delay**: `number`

#### token

> **token**: `unknown`
