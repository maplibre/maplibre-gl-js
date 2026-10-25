# MapMovementEvent

Defined in: [ui/events.ts:498](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L498>)

`MapMovementEvent` is the event type for the camera-transition map events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `rotatestart`, `rotate`, `rotateend`, `dragstart`, `drag`, `dragend`, `pitchstart`, `pitch`, `pitchend`, `rollstart`, `roll` and `rollend`. These are fired as the map's view changes, as a result of either user interaction or methods such as [Map.jumpTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#jumpto>) / [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`MouseEvent` | `TouchEvent` | `WheelEvent` | `undefined`\>

## Properties

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:485](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L485>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)
