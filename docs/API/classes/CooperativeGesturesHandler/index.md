# CooperativeGesturesHandler

Defined in: [ui/handler/cooperative\_gestures.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/cooperative_gestures.ts#L28>)

A `CooperativeGestureHandler` is a control that adds cooperative gesture info when user tries to zoom in/out.

When the CooperativeGestureHandler blocks a gesture, it will emit a `cooperativegestureprevented` event.

## Example

```ts
const map = new Map({
  cooperativeGestures: true
});
```

## See

[Example: cooperative gestures](<https://maplibre.org/maplibre-gl-js/docs/examples/cooperative-gestures/>)

## Implements

- [`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>)

## Methods

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/cooperative\_gestures.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/cooperative_gestures.ts#L43>)

This is used to indicate if the handler is currently active or not. In case a handler is active, it will block other handlers from getting the relevant events. There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.

#### Returns

`boolean`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`isActive`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#isactive>)

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler/cooperative\_gestures.ts:46](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/cooperative_gestures.ts#L46>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`reset`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#reset>)

## Properties

### \_bypassKey

> **\_bypassKey**: `"ctrlKey"` | `"metaKey"`

Defined in: [ui/handler/cooperative\_gestures.ts:35](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/cooperative_gestures.ts#L35>)

This is the key that will allow to bypass the cooperative gesture protection
