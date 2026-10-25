# DragRotateHandler

Defined in: [ui/handler/shim/drag\_rotate.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/handler/shim/drag_rotate.ts#L56>)

The `DragRotateHandler` allows the user to rotate the map by clicking and dragging the cursor while holding the right mouse button or `ctrl` key.

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/shim/drag\_rotate.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/handler/shim/drag_rotate.ts#L110>)

Disables the "drag to rotate" interaction.

#### Returns

`void`

#### Example

```ts
map.dragRotate.disable();
```

---

### enable()

> **enable**(`options?`: `boolean` | [`DragRotateOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DragRotateOptions/index.md>)): `void`

Defined in: [ui/handler/shim/drag\_rotate.ts:93](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/handler/shim/drag_rotate.ts#L93>)

Enables the "drag to rotate" interaction.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | `boolean` \| [`DragRotateOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DragRotateOptions/index.md>) | Options object |

#### Returns

`void`

#### Example

```ts
map.dragRotate.enable();
map.dragRotate.enable({around: 'pointer'});
map.dragRotate.enable({around: 'center', movement: 'linear'});
```

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/shim/drag\_rotate.ts:130](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/handler/shim/drag_rotate.ts#L130>)

Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "drag to rotate" interaction is active.

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/shim/drag\_rotate.ts:121](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/handler/shim/drag_rotate.ts#L121>)

Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.

#### Returns

`boolean`

`true` if the "drag to rotate" interaction is enabled.
