# MapLibreEvent\<TOrig = `unknown`\>

Defined in: [ui/events.ts:483](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L483>)

The base event for MapLibre

## Extends

- [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

## Extended by

- [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>)
- [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)
- [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)
- [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)
- [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>)
- [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>)
- [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)
- [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>)
- [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)
- [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>)
- [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)
- [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>)

## Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `TOrig` | `unknown` |

## Properties

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:485](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L485>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Overrides

[`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/#target>)
