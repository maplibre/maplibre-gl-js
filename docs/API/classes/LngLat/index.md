# LngLat

Defined in: [geo/lng\_lat.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L51>)

A `LngLat` object represents a given longitude and latitude coordinate, measured in degrees. These coordinates are based on the [WGS84 (EPSG:4326) standard](<https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84>).

MapLibre GL JS uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match the [GeoJSON specification](<https://tools.ietf.org/html/rfc7946>).

Note that any MapLibre GL JS method that accepts a `LngLat` object as an argument or option can also accept an `Array` of two numbers and will perform an implicit conversion. This flexible type is documented as [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>).

## Example

```ts
let ll = new LngLat(-123.9749, 40.7736);
ll.lng; // = -123.9749
```

## See

[Get coordinates of the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-coordinates-of-the-mouse-pointer/>)

## Constructors

### Constructor

> **new LngLat**(`lng`: `number`, `lat`: `number`): `LngLat`

Defined in: [geo/lng\_lat.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L66>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lng` | `number` | Longitude, measured in degrees. |
| `lat` | `number` | Latitude, measured in degrees. |

#### Returns

`LngLat`

## Methods

### distanceTo()

> **distanceTo**(`lngLat`: `LngLat`): `number`

Defined in: [geo/lng\_lat.ts:133](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L133>)

Returns the approximate distance between a pair of coordinates in meters Uses the Haversine Formula (from R.W. Sinnott, "Virtues of the Haversine", Sky and Telescope, vol. 68, no. 2, 1984, p. 159)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lngLat` | `LngLat` | coordinates to compute the distance to |

#### Returns

`number`

Distance in meters between the two coordinates.

#### Example

```ts
let new_york = new LngLat(-74.0060, 40.7128);
let los_angeles = new LngLat(-118.2437, 34.0522);
new_york.distanceTo(los_angeles); // = 3935751.690893987, "true distance" using a non-spherical approximation is ~3966km
```

---

### toArray()

> **toArray**(): \[`number`, `number`\]

Defined in: [geo/lng\_lat.ts:102](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L102>)

Returns the coordinates represented as an array of two numbers.

#### Returns

\[`number`, `number`\]

The coordinates represented as an array of longitude and latitude.

#### Example

```ts
let ll = new LngLat(-73.9749, 40.7736);
ll.toArray(); // = [-73.9749, 40.7736]
```

---

### toString()

> **toString**(): `string`

Defined in: [geo/lng\_lat.ts:116](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L116>)

Returns the coordinates represent as a string.

#### Returns

`string`

The coordinates represented as a string of the format `'LngLat(lng, lat)'`.

#### Example

```ts
let ll = new LngLat(-73.9749, 40.7736);
ll.toString(); // = "LngLat(-73.9749, 40.7736)"
```

---

### wrap()

> **wrap**(): `LngLat`

Defined in: [geo/lng\_lat.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L88>)

Returns a new `LngLat` object whose longitude is wrapped to the range (-180, 180).

#### Returns

`LngLat`

The wrapped `LngLat` object.

#### Example

```ts
let ll = new LngLat(286.0251, 40.7736);
let wrapped = ll.wrap();
wrapped.lng; // = -73.9749
```

---

### convert()

> `static` **convert**(`input`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `LngLat`

Defined in: [geo/lng\_lat.ts:157](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L157>)

Converts an array of two numbers or an object with `lng` and `lat` or `lon` and `lat` properties to a `LngLat` object.

If a `LngLat` object is passed in, the function returns it unchanged.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `input` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | An array of two numbers or object to convert, or a `LngLat` object to return. |

#### Returns

`LngLat`

A new `LngLat` object, if a conversion occurred, or the original `LngLat` object.

#### Example

```ts
let arr = [-73.9749, 40.7736];
let ll = LngLat.convert(arr);
ll;   // = LngLat {lng: -73.9749, lat: 40.7736}
```

## Properties

### lat

> **lat**: `number`

Defined in: [geo/lng\_lat.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L60>)

Latitude, measured in degrees.

---

### lng

> **lng**: `number`

Defined in: [geo/lng\_lat.ts:55](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat.ts#L55>)

Longitude, measured in degrees.
