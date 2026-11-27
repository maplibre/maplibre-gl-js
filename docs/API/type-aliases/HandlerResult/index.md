# HandlerResult

> **HandlerResult** = `object`

Defined in: [ui/handler\_manager.ts:116](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L116>)

All handler methods that are called with events can optionally return a `HandlerResult`.

## Properties

### around?

> `optional` **around?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:125](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L125>)

the point to not move when changing the camera

---

### easeTo?

> `optional` **easeTo?**: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>)

Defined in: [ui/handler\_manager.ts:135](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L135>)

A one-off easing of the camera, such as a double click's zoom, that ends the gesture: every handler is reset before it starts, so that the next frame of a handler does not stop it, and its events carry the input event that asked for it as `originalEvent`.

---

### needsRenderFrame?

> `optional` **needsRenderFrame?**: `boolean`

Defined in: [ui/handler\_manager.ts:150](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L150>)

Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).

---

### noInertia?

> `optional` **noInertia?**: `boolean`

Defined in: [ui/handler\_manager.ts:154](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L154>)

The camera changes won't get recorded for inertial zooming.

---

### originalEvent?

> `optional` **originalEvent?**: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

Defined in: [ui/handler\_manager.ts:146](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L146>)

The last three properties are needed by only one handler: scrollzoom. The DOM event to be used as the `originalEvent` on any camera change events.

---

### pinchAround?

> `optional` **pinchAround?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:129](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L129>)

same as above, except for pinch actions, which are given higher priority

---

### timeout?

> `optional` **timeout?**: `object`

Defined in: [ui/handler\_manager.ts:141](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/handler_manager.ts#L141>)

Asks the manager to call the handler's `onTimeout` with `token` after `delay` milliseconds, for a handler that waits for input that may not come, such as a wheel zoom telling a mouse wheel from a trackpad. The handler ignores a timeout whose token it no longer waits for, so it never needs to cancel one.

#### delay

> **delay**: `number`

#### token

> **token**: `unknown`
