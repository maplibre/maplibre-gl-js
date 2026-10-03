# MapBoxZoomEvent

Defined in: [ui/events.ts:801](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L801>)

A `MapBoxZoomEvent` is the event type for the boxzoom-related map events emitted by the [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`MouseEvent`\>

## Properties

### originalEvent

> **originalEvent**: `MouseEvent`

Defined in: [ui/events.ts:813](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L813>)

The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`

#### Overrides

`MapLibreEvent.originalEvent`

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:809](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L809>)

The `Map` instance that triggered the event

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"boxzoomcancel"` | `"boxzoomstart"` | `"boxzoomend"`

Defined in: [ui/events.ts:805](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L805>)

The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`

#### Overrides

`MapLibreEvent.type`
