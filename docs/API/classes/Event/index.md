# Event\<TType *extends* `string` = `string`\>

Defined in: [util/evented.ts:45](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L45>)

The event class

## Extended by

- [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)
- [`GeolocatePositionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>)
- [`GeolocateErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateErrorEvent/index.md>)
- [`FullscreenEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>)
- [`PopupEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>)
- [`MarkerDragEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>)
- [`MarkerClickEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerClickEvent/index.md>)
- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)
- [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)

## Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `TType` *extends* `string` | `string` |

## Properties

### target?

> `optional` **target?**: `unknown`

Defined in: [util/evented.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L51>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.
