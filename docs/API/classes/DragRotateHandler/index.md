# DragRotateHandler

Defined in: [ui/handler/shim/drag\_rotate.ts:25](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_rotate.ts#L25>)

The `DragRotateHandler` allows the user to rotate the map by clicking and dragging the cursor while holding the right mouse button or `ctrl` key.

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/shim/drag\_rotate.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_rotate.ts#L64>)

Disables the "drag to rotate" interaction.

#### Returns

`void`

#### Example

```ts
map.dragRotate.disable();
```

---

### enable()

> **enable**(): `void`

Defined in: [ui/handler/shim/drag\_rotate.ts:50](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_rotate.ts#L50>)

Enables the "drag to rotate" interaction.

#### Returns

`void`

#### Example

```ts
map.dragRotate.enable();
```

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/shim/drag\_rotate.ts:84](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_rotate.ts#L84>)

Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "drag to rotate" interaction is active.

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/shim/drag\_rotate.ts:75](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_rotate.ts#L75>)

Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.

#### Returns

`boolean`

`true` if the "drag to rotate" interaction is enabled.
