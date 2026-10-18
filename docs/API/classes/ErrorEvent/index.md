# ErrorEvent

Defined in: [util/evented.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/evented.ts#L66>)

An error event

## Extends

- [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)\<`"error"`\>

## Properties

### target?

> `optional` **target?**: `unknown`

Defined in: [util/evented.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/evented.ts#L51>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/#target>)
