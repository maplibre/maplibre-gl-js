# TwoFingersTouchZoomRotateHandler

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:13](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L13>)

The `TwoFingersTouchZoomRotateHandler` allows the user to zoom and rotate the map by pinching on a touchscreen.

They can zoom with one finger by double tapping and dragging. On the second tap, hold the finger down and drag up or down to zoom in or out.

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L58>)

Disables the "pinch to rotate and zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.touchZoomRotate.disable();
```

---

### disableRotation()

> **disableRotation**(): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:121](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L121>)

Disables the "pinch to rotate" interaction, leaving the "pinch to zoom" interaction enabled.

#### Returns

`void`

#### Example

```ts
map.touchZoomRotate.disableRotation();
```

---

### enable()

> **enable**(`options?`: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L43>)

Enables the "pinch to rotate and zoom" interaction.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | `boolean` \| [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>) | Options object. |

#### Returns

`void`

#### Example

```ts
map.touchZoomRotate.enable();
map.touchZoomRotate.enable({ around: 'center' });
```

---

### enableRotation()

> **enableRotation**(): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:135](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L135>)

Enables the "pinch to rotate" interaction.

#### Returns

`void`

#### Example

```ts
map.touchZoomRotate.enable();
map.touchZoomRotate.enableRotation();
```

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L81>)

Returns true if the handler is enabled and has detected the start of a zoom/rotate gesture.

#### Returns

`boolean`

`true` if the handler is active, `false` otherwise

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L70>)

Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.

#### Returns

`boolean`

`true` if the "pinch to rotate and zoom" interaction is enabled.

---

### setZoomRate()

> **setZoomRate**(`zoomRate?`: `number`): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:94](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L94>)

Sets the zoom rate of touch gestures.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `zoomRate?` | `number` | 1 The rate used to scale touch movement to a zoom value. Set to `undefined` to restore the default. |

#### Returns

`void`

#### Example

Slow down touch zoom

```ts
map.touchZoomRotate.setZoomRate(0.5);
```

---

### setZoomThreshold()

> **setZoomThreshold**(`zoomThreshold?`: `number`): `void`

Defined in: [ui/handler/shim/two\_fingers\_touch.ts:108](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/two_fingers_touch.ts#L108>)

Sets the threshold before a pinch gesture starts zooming.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `zoomThreshold?` | `number` | 0.1 The minimum zoom delta before the pinch gesture becomes active. Set to `undefined` to restore the default. |

#### Returns

`void`

#### Example

Make pinch zoom less sensitive

```ts
map.touchZoomRotate.setZoomThreshold(0.3);
```
