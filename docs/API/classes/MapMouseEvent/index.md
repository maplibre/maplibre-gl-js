# MapMouseEvent

Defined in: [ui/events.ts:611](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L611>)

`MapMouseEvent` is the event type for mouse-related map events.

## Example

```ts
// The `click` event is an example of a `MapMouseEvent`.
// Set up an event listener on the map.
map.on('click', (e) => {
  // The event object (e) contains information like the
  // coordinates of the point on the map that was clicked.
  console.log('A click event has occurred at ' + e.lngLat);
});
```

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`MouseEvent`\>

## Accessors

### defaultPrevented

#### Get Signature

> **get** **defaultPrevented**(): `boolean`

Defined in: [ui/events.ts:655](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L655>)

`true` if `preventDefault` has been called.

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [ui/events.ts:648](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L648>)

Prevents subsequent default processing of the event by the map.

Calling this method will prevent the following default map behaviors:

- On `mousedown` events, the behavior of [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>)
- On `mousedown` events, the behavior of [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>)
- On `mousedown` events, the behavior of [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>)
- On `dblclick` events, the behavior of [DoubleClickZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>)

#### Returns

`void`

## Properties

### lngLat

> **lngLat**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/events.ts:635](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L635>)

The geographic location on the map of the mouse cursor.

---

### originalEvent

> **originalEvent**: `MouseEvent`

Defined in: [ui/events.ts:625](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L625>)

The DOM event which caused the map event.

#### Overrides

`MapLibreEvent.originalEvent`

---

### point

> **point**: `Point`

Defined in: [ui/events.ts:630](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L630>)

The pixel coordinates of the mouse cursor, relative to the map and measured from the top left corner.

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:620](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L620>)

The `Map` object that fired the event.

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"click"` | `"contextmenu"` | `"dblclick"` | `"mousedown"` | `"mouseenter"` | `"mouseleave"` | `"mousemove"` | `"mouseout"` | `"mouseover"` | `"mouseup"`

Defined in: [ui/events.ts:615](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L615>)

The event type

#### Overrides

`MapLibreEvent.type`
