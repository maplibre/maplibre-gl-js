# ScrollZoomHandler

Defined in: [ui/handler/scroll\_zoom.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L43>)

The `ScrollZoomHandler` allows the user to zoom the map by scrolling.

## Implements

- [`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>)

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/scroll\_zoom.ts:161](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L161>)

Disables the "scroll to zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.scrollZoom.disable();
```

#### Implementation of

`Handler.disable`

---

### enable()

> **enable**(`options?`: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)): `void`

Defined in: [ui/handler/scroll\_zoom.ts:147](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L147>)

Enables the "scroll to zoom" interaction.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | `boolean` \| [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>) | Options object. |

#### Returns

`void`

#### Example

```ts
map.scrollZoom.enable();
map.scrollZoom.enable({ around: 'center' })
```

#### Implementation of

`Handler.enable`

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/scroll\_zoom.ts:129](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L129>)

This is used to indicate if the handler is currently active or not. In case a handler is active, it will block other handlers from getting the relevant events. There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.

#### Returns

`boolean`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`isActive`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md#isactive>)

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/scroll\_zoom.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L120>)

Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.

#### Returns

`boolean`

`true` if the "scroll to zoom" interaction is enabled.

#### Implementation of

`Handler.isEnabled`

---

### isZooming()

> **isZooming**(): `boolean`

Defined in: [ui/handler/scroll\_zoom.ts:133](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L133>)

Whether the handler is zooming the map apart from the zoom deltas it returns, such as a wheel zoom between a wheel event and its first frame.

#### Returns

`boolean`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`isZooming`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md#iszooming>)

---

### renderFrame()

> **renderFrame**(): `void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

Defined in: [ui/handler/scroll\_zoom.ts:291](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L291>)

`renderFrame` is the only non-dom event. It is called during render frames and can be used to smooth camera changes (see scroll handler).

#### Returns

`void` | [`HandlerResult`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/HandlerResult/index.md>)

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`renderFrame`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md#renderframe>)

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler/scroll\_zoom.ts:411](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L411>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`reset`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md#reset>)

---

### setWheelZoomRate()

> **setWheelZoomRate**(`wheelZoomRate`: `number`): `void`

Defined in: [ui/handler/scroll\_zoom.ts:112](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L112>)

Set the zoom rate of a mouse wheel

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `wheelZoomRate` | `number` | 1/450 The rate used to scale mouse wheel movement to a zoom value. |

#### Returns

`void`

#### Example

Slow down zoom of mouse wheel

```ts
map.scrollZoom.setWheelZoomRate(1/600);
```

---

### setZoomRate()

> **setZoomRate**(`zoomRate`: `number`): `void`

Defined in: [ui/handler/scroll\_zoom.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/ui/handler/scroll_zoom.ts#L99>)

Set the zoom rate of a trackpad

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `zoomRate` | `number` | 1/100 The rate used to scale trackpad movement to a zoom value. |

#### Returns

`void`

#### Example

Speed up trackpad zoom

```ts
map.scrollZoom.setZoomRate(1/25);
```
