# MapProjectionEvent

Defined in: [ui/events.ts:840](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L840>)

The map projection event

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

## Properties

### newProjection

> **newProjection**: `PropertyValueSpecification`\<`ProjectionDefinitionSpecification`\>

Defined in: [ui/events.ts:850](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L850>)

Specifies the name of the new projection. For example:

- `globe` to describe globe that has internally switched to mercator
- `vertical-perspective` to describe a globe that doesn't change to mercator
- `mercator` to describe mercator projection

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:491](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L491>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md#target>)
