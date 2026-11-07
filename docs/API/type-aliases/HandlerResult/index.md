# HandlerResult

> **HandlerResult** = `object`

Defined in: [ui/handler\_manager.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L113>)

All handler methods that are called with events can optionally return a `HandlerResult`.

## Properties

### around?

> `optional` **around?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L122>)

the point to not move when changing the camera

---

### cameraAnimation?

> `optional` **cameraAnimation?**: (`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)) =\> `void`

Defined in: [ui/handler\_manager.ts:131](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L131>)

A method that can fire a one-off easing by directly changing the map's camera. The gesture ends with it: every handler is reset before it runs, so that the next frame of a handler does not stop the easing.

#### Parameters

| Parameter | Type |
| --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) |

#### Returns

`void`

---

### needsRenderFrame?

> `optional` **needsRenderFrame?**: `boolean`

Defined in: [ui/handler\_manager.ts:140](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L140>)

Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).

---

### noInertia?

> `optional` **noInertia?**: `boolean`

Defined in: [ui/handler\_manager.ts:144](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L144>)

The camera changes won't get recorded for inertial zooming.

---

### originalEvent?

> `optional` **originalEvent?**: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

Defined in: [ui/handler\_manager.ts:136](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L136>)

The last three properties are needed by only one handler: scrollzoom. The DOM event to be used as the `originalEvent` on any camera change events.

---

### pinchAround?

> `optional` **pinchAround?**: `Point` | `null`

Defined in: [ui/handler\_manager.ts:126](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/ui/handler_manager.ts#L126>)

same as above, except for pinch actions, which are given higher priority
