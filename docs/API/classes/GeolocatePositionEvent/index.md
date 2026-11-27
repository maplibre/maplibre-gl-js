# GeolocatePositionEvent

Defined in: [ui/control/geolocate\_control.ts:87](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/control/geolocate_control.ts#L87>)

The event class for the geolocate control `geolocate` and `outofmaxbounds` events. Carries the [Position](<https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPosition>) returned by the Geolocation API.

## Extends

- [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

## Properties

### coords

> **coords**: `GeolocationCoordinates`

Defined in: [ui/control/geolocate\_control.ts:96](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/control/geolocate_control.ts#L96>)

The geographic position returned by the Geolocation API.

---

### target

> **target**: [`GeolocateControl`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/index.md>)

Defined in: [ui/control/geolocate\_control.ts:92](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/control/geolocate_control.ts#L92>)

The `GeolocateControl` object that fired the event.

#### Overrides

[`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md#target>)

---

### timestamp

> **timestamp**: `number`

Defined in: [ui/control/geolocate\_control.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/control/geolocate_control.ts#L100>)

The time at which the position was acquired, in milliseconds since the Unix epoch.
