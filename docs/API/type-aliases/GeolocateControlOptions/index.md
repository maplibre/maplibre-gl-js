# GeolocateControlOptions

> **GeolocateControlOptions** = `object`

Defined in: [ui/control/geolocate\_control.ts:16](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L16>)

The [GeolocateControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/index.md>) options object

## Properties

### fitBoundsOptions?

> `optional` **fitBoundsOptions?**: [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>)

Defined in: [ui/control/geolocate\_control.ts:25](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L25>)

A options object to use when the map is panned and zoomed to the user's location. The default is to use a `maxZoom` of 15 to limit how far the map will zoom in for very accurate locations.

---

### positionOptions?

> `optional` **positionOptions?**: `PositionOptions`

Defined in: [ui/control/geolocate\_control.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L21>)

A Geolocation API [PositionOptions](<https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions>) object.

#### Default Value

`{enableHighAccuracy: false, timeout: 6000}`

---

### showAccuracyCircle?

> `optional` **showAccuracyCircle?**: `boolean`

Defined in: [ui/control/geolocate\_control.ts:35](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L35>)

By default, if `showUserLocation` is `true`, a transparent circle will be drawn around the user location indicating the accuracy (95% confidence level) of the user's location. Set to `false` to disable. Always disabled when `showUserLocation` is `false`.

#### Default Value

```ts
true
```

---

### showUserLocation?

> `optional` **showUserLocation?**: `boolean`

Defined in: [ui/control/geolocate\_control.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L40>)

By default a dot will be shown on the map at the user's location. Set to `false` to disable.

#### Default Value

```ts
true
```

---

### trackUserLocation?

> `optional` **trackUserLocation?**: `boolean`

Defined in: [ui/control/geolocate\_control.ts:30](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L30>)

If `true` the `GeolocateControl` becomes a toggle button and when active the map will receive updates to the user's location as it changes.

#### Default Value

```ts
false
```

---

### zoomToUserAccuracy?

> `optional` **zoomToUserAccuracy?**: `boolean`

Defined in: [ui/control/geolocate\_control.ts:46](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L46>)

If `true` then map updates from the user's location may also change the map zoom level based on the location update accuracy. If `false` then the map zoom level will not change. Has no effect when `trackUserLocation` is `false`.

#### Default Value

```ts
true
```
