# DoubleClickZoomHandler

Defined in: [ui/handler/shim/dblclick\_zoom.ts:10](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/dblclick_zoom.ts#L10>)

The `DoubleClickZoomHandler` allows the user to zoom the map at a point by double clicking or double tapping.

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/shim/dblclick\_zoom.ts:42](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/dblclick_zoom.ts#L42>)

Disables the "double click to zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.doubleClickZoom.disable();
```

---

### enable()

> **enable**(): `void`

Defined in: [ui/handler/shim/dblclick\_zoom.ts:29](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/dblclick_zoom.ts#L29>)

Enables the "double click to zoom" interaction.

#### Returns

`void`

#### Example

```ts
map.doubleClickZoom.enable();
```

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/shim/dblclick\_zoom.ts:61](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/dblclick_zoom.ts#L61>)

Returns a Boolean indicating whether the "double click to zoom" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "double click to zoom" interaction is active.

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/shim/dblclick\_zoom.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/dblclick_zoom.ts#L52>)

Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.

#### Returns

`boolean`

`true` if the "double click to zoom" interaction is enabled.
