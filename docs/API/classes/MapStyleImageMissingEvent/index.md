# MapStyleImageMissingEvent

Defined in: [ui/events.ts:871](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L871>)

The style image missing event, fired when an image is still missing after the missing style image resolver has been given a chance to supply it. To load or generate images on demand, use [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>). Event listeners cannot resolve the missing image for the current request.

## See

[Generate and add a missing icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/generate-and-add-a-missing-icon-to-the-map/>)

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

## Properties

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:485](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L485>)

The object that fired the event. Set when the event is fired, and narrowed to a more specific type (e.g. `Map`, `Marker`) by the event subclasses.

#### Inherited from

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)
