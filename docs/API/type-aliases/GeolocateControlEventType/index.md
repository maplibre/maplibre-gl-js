# GeolocateControlEventType

> **GeolocateControlEventType** = `object`

Defined in: [ui/control/geolocate\_control.ts:131](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L131>)

`GeolocateControlEventType` - a mapping between the geolocate control event name and the event value. These events are used with the [GeolocateControl.on](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/#on>) method.

## Properties

### error

> **error**: [`GeolocateErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateErrorEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:139](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L139>)

Fired on each Geolocation API position update which returned as an error.

---

### geolocate

> **geolocate**: [`GeolocatePositionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:135](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L135>)

Fired on each Geolocation API position update which returned as success.

---

### outofmaxbounds

> **outofmaxbounds**: [`GeolocatePositionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L143>)

Fired on each Geolocation API position update which returned as success but the user position is out of map `maxBounds`.

---

### trackuserlocationend

> **trackuserlocationend**: [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:151](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L151>)

Fired when the geolocate control changes to the background state.

---

### trackuserlocationstart

> **trackuserlocationstart**: [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:147](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L147>)

Fired when the geolocate control changes to the active lock state.

---

### userlocationfocus

> **userlocationfocus**: [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:155](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L155>)

Fired when the geolocate control's button is clicked in the active lock state.

---

### userlocationlostfocus

> **userlocationlostfocus**: [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)

Defined in: [ui/control/geolocate\_control.ts:159](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L159>)

Fired when the user changes the viewport while in the active lock state.
