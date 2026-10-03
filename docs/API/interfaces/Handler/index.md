# Handler

Defined in: [ui/handler\_manager.ts:72](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L72>)

Handlers interpret dom events and return camera changes that should be applied to the map (`HandlerResult`s). The camera changes are all deltas. The handler itself should have no knowledge of the map's current state. This makes it easier to merge multiple results and keeps handlers simpler. For example, if there is a mousedown and mousemove, the mousePan handler would return a `panDelta` on the mousemove.

## Methods

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler\_manager.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L81>)

This is used to indicate if the handler is currently active or not. In case a handler is active, it will block other handlers from getting the relevant events. There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.

#### Returns

`boolean`

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler\_manager.ts:85](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L85>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

## Properties

### renderFrame?

> `readonly` `optional` **renderFrame?**: () =\> `void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

Defined in: [ui/handler\_manager.ts:107](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/handler_manager.ts#L107>)

`renderFrame` is the only non-dom event. It is called during render frames and can be used to smooth camera changes (see scroll handler).

#### Returns

`void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)
