# MapBoxZoomEvent

Defined in: [ui/events.ts:807](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L807>)

A `MapBoxZoomEvent` is the event type for the boxzoom-related map events emitted by the [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`MouseEvent`\>

## Properties

### originalEvent

> **originalEvent**: `MouseEvent`

Defined in: [ui/events.ts:819](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L819>)

The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`

#### Overrides

`MapLibreEvent.originalEvent`

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:815](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L815>)

The `Map` instance that triggered the event

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md#target>)

---

### type

> **type**: `"boxzoomcancel"` | `"boxzoomstart"` | `"boxzoomend"`

Defined in: [ui/events.ts:811](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L811>)

The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`

#### Overrides

`MapLibreEvent.type`
