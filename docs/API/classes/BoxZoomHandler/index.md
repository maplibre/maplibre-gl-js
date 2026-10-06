# BoxZoomHandler

Defined in: [ui/handler/box\_zoom.ts:31](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L31>)

The `BoxZoomHandler` allows the user to zoom the map to fit within a bounding box. The bounding box is defined by clicking and holding `shift` while dragging the cursor.

## Implements

- [`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>)

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/box\_zoom.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L98>)

Disables the "box zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.boxZoom.disable();
```

#### Implementation of

`Handler.disable`

---

### enable()

> **enable**(): `void`

Defined in: [ui/handler/box\_zoom.ts:85](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L85>)

Enables the "box zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.boxZoom.enable();
```

#### Implementation of

`Handler.enable`

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/box\_zoom.ts:73](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L73>)

Returns a Boolean indicating whether the "box zoom" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "box zoom" interaction is active.

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`isActive`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#isactive>)

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/box\_zoom.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L64>)

Returns a Boolean indicating whether the "box zoom" interaction is enabled.

#### Returns

`boolean`

`true` if the "box zoom" interaction is enabled.

#### Implementation of

`Handler.isEnabled`

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler/box\_zoom.ts:176](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/box_zoom.ts#L176>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`reset`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#reset>)
