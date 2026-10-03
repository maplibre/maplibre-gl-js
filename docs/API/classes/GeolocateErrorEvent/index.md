# GeolocateErrorEvent

Defined in: [ui/control/geolocate\_control.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L109>)

The event class for the geolocate control `error` event. Carries the [PositionError](<https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError>) returned by the Geolocation API.

## Extends

- [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)

## Properties

### code

> **code**: `number`

Defined in: [ui/control/geolocate\_control.ts:118](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L118>)

The error code returned by the Geolocation API.

---

### message

> **message**: `string`

Defined in: [ui/control/geolocate\_control.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L122>)

The error message returned by the Geolocation API.

---

### target

> **target**: [`GeolocateControl`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/index.md>)

Defined in: [ui/control/geolocate\_control.ts:114](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L114>)

The `GeolocateControl` object that fired the event.

#### Overrides

[`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/#target>)
