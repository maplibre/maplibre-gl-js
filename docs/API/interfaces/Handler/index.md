# Handler

Defined in: [ui/handler\_manager.ts:59](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L59>)

Handlers interpret dom events and return camera changes that should be applied to the map (`HandlerResult`s). The camera changes are all deltas. The handler itself should have no knowledge of the map's current state. This makes it easier to merge multiple results and keeps handlers simpler. For example, if there is a mousedown and mousemove, the mousePan handler would return a `panDelta` on the mousemove.

## Methods

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler\_manager.ts:68](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L68>)

This is used to indicate if the handler is currently active or not. In case a handler is active, it will block other handlers from getting the relevant events. There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.

#### Returns

`boolean`

---

### isZooming()?

> `optional` **isZooming**(): `boolean`

Defined in: [ui/handler\_manager.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L99>)

Whether the handler is zooming the map apart from the zoom deltas it returns, such as a wheel zoom between a wheel event and its first frame.

#### Returns

`boolean`

---

### onTimeout()?

> `optional` **onTimeout**(`token`: `unknown`): `void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

Defined in: [ui/handler\_manager.ts:105](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L105>)

Called by the manager when a timeout the handler asked for runs out, see [HandlerResult.timeout](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/#timeout>). The manager runs a render frame when the result asks for one. The token is opaque to the manager, so a handler declares the parameter as the type of the tokens it hands out.

#### Parameters

| Parameter | Type |
| --- | --- |
| `token` | `unknown` |

#### Returns

`void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler\_manager.ts:72](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L72>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

## Properties

### renderFrame?

> `readonly` `optional` **renderFrame?**: () =\> `void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

Defined in: [ui/handler\_manager.ts:94](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler_manager.ts#L94>)

`renderFrame` is the only non-dom event. It is called during render frames and can be used to smooth camera changes (see scroll handler).

#### Returns

`void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)
