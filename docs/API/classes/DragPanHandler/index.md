# DragPanHandler

Defined in: [ui/handler/shim/drag\_pan.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L37>)

The `DragPanHandler` allows the user to pan the map by clicking and dragging the cursor.

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/shim/drag\_pan.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L81>)

Disables the "drag to pan" interaction.

#### Returns

`void`

#### Example

```ts
map.dragPan.disable();
```

---

### enable()

> **enable**(`options?`: `boolean` | [`DragPanOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DragPanOptions/index.md>)): `void`

Defined in: [ui/handler/shim/drag\_pan.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L66>)

Enables the "drag to pan" interaction.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | `boolean` \| [`DragPanOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DragPanOptions/index.md>) | Options object |

#### Returns

`void`

#### Example

```ts
  map.dragPan.enable();
  map.dragPan.enable({
     linearity: 0.3,
     easing: bezier(0, 0, 0.3, 1),
     maxSpeed: 1400,
     deceleration: 2500,
  });
```

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/shim/drag\_pan.ts:101](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L101>)

Returns a Boolean indicating whether the "drag to pan" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "drag to pan" interaction is active.

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/shim/drag\_pan.ts:92](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L92>)

Returns a Boolean indicating whether the "drag to pan" interaction is enabled.

#### Returns

`boolean`

`true` if the "drag to pan" interaction is enabled.
