# MapBoxZoomEvent

Defined in: [ui/events.ts:808](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L808>)

A `MapBoxZoomEvent` is the event type for the boxzoom-related map events emitted by the [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`MouseEvent`\>

## Properties

### originalEvent

> **originalEvent**: `MouseEvent`

Defined in: [ui/events.ts:820](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L820>)

The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`

#### Overrides

`MapLibreEvent.originalEvent`

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:816](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L816>)

The `Map` instance that triggered the event

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"boxzoomcancel"` | `"boxzoomstart"` | `"boxzoomend"`

Defined in: [ui/events.ts:812](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L812>)

The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`

#### Overrides

`MapLibreEvent.type`
