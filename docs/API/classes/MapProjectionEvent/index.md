# MapProjectionEvent

Defined in: [ui/events.ts:834](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L834>)

The map projection event

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

## Properties

### newProjection

> **newProjection**: `PropertyValueSpecification`\<`ProjectionDefinitionSpecification`\>

Defined in: [ui/events.ts:844](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L844>)

Specifies the name of the new projection. For example:

- `globe` to describe globe that has internally switched to mercator
- `vertical-perspective` to describe a globe that doesn't change to mercator
- `mercator` to describe mercator projection

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:485](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/events.ts#L485>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)
