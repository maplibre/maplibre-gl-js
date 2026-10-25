# MapStyleLoadEvent

Defined in: [ui/events.ts:509](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L509>)

The `style.load` event, fired once the map's style has fully loaded or changed.

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

## Properties

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:485](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L485>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)
