# LngLatBounds

Defined in: [geo/lng\_lat\_bounds.ts:44](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L44>)

A `LngLatBounds` object represents a geographical bounding box, defined by its southwest and northeast points in longitude and latitude.

If no arguments are provided to the constructor, a `null` bounding box is created.

Note that any MapLibre GL method that accepts a `LngLatBounds` object as an argument or option can also accept an `Array` of two [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) constructs and will perform an implicit conversion. This flexible type is documented as [LngLatBoundsLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>).

## Example

```ts
let sw = new LngLat(-73.9876, 40.7661);
let ne = new LngLat(-73.9397, 40.8002);
let llb = new LngLatBounds(sw, ne);
```

## See

[Fit to the bounds of a LineString](<https://maplibre.org/maplibre-gl-js/docs/examples/fit-to-the-bounds-of-a-linestring/>)

## Constructors

### Constructor

> **new LngLatBounds**(`sw?`: \[`number`, `number`, `number`, `number`\] | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | \[[`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)\], `ne?`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `LngLatBounds`

Defined in: [geo/lng\_lat\_bounds.ts:68](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L68>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sw?` | \[`number`, `number`, `number`, `number`\] \| [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) \| \[[`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)\] | The southwest corner of the bounding box. OR array of 4 numbers in the order of west, south, east, north OR array of 2 LngLatLike: `[sw, ne]` |
| `ne?` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The northeast corner of the bounding box. |

#### Returns

`LngLatBounds`

#### Example

```ts
let sw = new LngLat(-73.9876, 40.7661);
let ne = new LngLat(-73.9397, 40.8002);
let llb = new LngLatBounds(sw, ne);
```

OR

```ts
let llb = new LngLatBounds([-73.9876, 40.7661, -73.9397, 40.8002]);
```

OR

```ts
let llb = new LngLatBounds([sw, ne]);
```

## Methods

### adjustAntiMeridian()

> **adjustAntiMeridian**(): `LngLatBounds`

Defined in: [geo/lng\_lat\_bounds.ts:402](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L402>)

Adjusts the given bounds to handle the case where the bounds cross the 180th meridian (antimeridian).

#### Returns

`LngLatBounds`

The adjusted LngLatBounds

#### Example

```ts
let bounds = new LngLatBounds([175.813127, -20.157768], [-178. 340903, -15.449124]);
let adjustedBounds = bounds.adjustAntiMeridian();
// adjustedBounds will be: [[175.813127, -20.157768], [181.659097, -15.449124]]
```

---

### contains()

> **contains**(`lnglat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `boolean`

Defined in: [geo/lng\_lat\_bounds.ts:280](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L280>)

Check if the point is within the bounding box.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lnglat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | geographic point to check against. |

#### Returns

`boolean`

`true` if the point is within the bounding box.

#### Example

```ts
let llb = new LngLatBounds(
  new LngLat(-73.9876, 40.7661),
  new LngLat(-73.9397, 40.8002)
);

let ll = new LngLat(-73.9567, 40.7789);

console.log(llb.contains(ll)); // = true
```

---

### extend()

> **extend**(`obj`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)): `this`

Defined in: [geo/lng\_lat\_bounds.ts:108](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L108>)

Extend the bounds to include a given LngLatLike or LngLatBoundsLike.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `obj` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) \| [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) | object to extend to |

#### Returns

`this`

---

### getCenter()

> **getCenter**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/lng\_lat\_bounds.ts:164](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L164>)

Returns the geographical coordinate equidistant from the bounding box's corners.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The bounding box's center.

#### Example

```ts
let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
```

---

### getEast()

> **getEast**(): `number`

Defined in: [geo/lng\_lat\_bounds.ts:215](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L215>)

Returns the east edge of the bounding box.

#### Returns

`number`

The east edge of the bounding box.

---

### getNorth()

> **getNorth**(): `number`

Defined in: [geo/lng\_lat\_bounds.ts:222](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L222>)

Returns the north edge of the bounding box.

#### Returns

`number`

The north edge of the bounding box.

---

### getNorthEast()

> **getNorthEast**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/lng\_lat\_bounds.ts:180](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L180>)

Returns the northeast corner of the bounding box.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The northeast corner of the bounding box.

---

### getNorthWest()

> **getNorthWest**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/lng\_lat\_bounds.ts:187](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L187>)

Returns the northwest corner of the bounding box.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The northwest corner of the bounding box.

---

### getSouth()

> **getSouth**(): `number`

Defined in: [geo/lng\_lat\_bounds.ts:208](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L208>)

Returns the south edge of the bounding box.

#### Returns

`number`

The south edge of the bounding box.

---

### getSouthEast()

> **getSouthEast**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/lng\_lat\_bounds.ts:194](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L194>)

Returns the southeast corner of the bounding box.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The southeast corner of the bounding box.

---

### getSouthWest()

> **getSouthWest**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/lng\_lat\_bounds.ts:173](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L173>)

Returns the southwest corner of the bounding box.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The southwest corner of the bounding box.

---

### getWest()

> **getWest**(): `number`

Defined in: [geo/lng\_lat\_bounds.ts:201](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L201>)

Returns the west edge of the bounding box.

#### Returns

`number`

The west edge of the bounding box.

---

### intersects()

> **intersects**(`other`: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)): `boolean`

Defined in: [geo/lng\_lat\_bounds.ts:301](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L301>)

Checks if this bounding box intersects with another bounding box.

Returns true if the bounding boxes share any area, including cases where they only touch along an edge or at a corner.

This method properly handles cases where either or both bounding boxes cross the antimeridian (date line).

#### Parameters

| Parameter | Type |
| --- | --- |
| `other` | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) |

#### Returns

`boolean`

---

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [geo/lng\_lat\_bounds.ts:259](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L259>)

Check if the bounding box is an empty/`null`-type box.

#### Returns

`boolean`

True if bounds have been defined, otherwise false.

---

### setNorthEast()

> **setNorthEast**(`ne`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `this`

Defined in: [geo/lng\_lat\_bounds.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L88>)

Set the northeast corner of the bounding box

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `ne` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | a [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) object describing the northeast corner of the bounding box. |

#### Returns

`this`

---

### setSouthWest()

> **setSouthWest**(`sw`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `this`

Defined in: [geo/lng\_lat\_bounds.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L98>)

Set the southwest corner of the bounding box

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sw` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | a [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) object describing the southwest corner of the bounding box. |

#### Returns

`this`

---

### toArray()

> **toArray**(): \[\[`number`, `number`\], \[`number`, `number`\]\]

Defined in: [geo/lng\_lat\_bounds.ts:235](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L235>)

Returns the bounding box represented as an array.

#### Returns

\[\[`number`, `number`\], \[`number`, `number`\]\]

The bounding box represented as an array, consisting of the southwest and northeast coordinates of the bounding represented as arrays of numbers.

#### Example

```ts
let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
```

---

### toString()

> **toString**(): `string`

Defined in: [geo/lng\_lat\_bounds.ts:250](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L250>)

Return the bounding box represented as a string.

#### Returns

`string`

The bounding box represents as a string of the format `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`.

#### Example

```ts
let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
```

---

### convert()

> `static` **convert**(`input`: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)): `LngLatBounds`

Defined in: [geo/lng\_lat\_bounds.ts:364](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L364>)

Converts an array to a `LngLatBounds` object.

If a `LngLatBounds` object is passed in, the function returns it unchanged.

Internally, the function calls [LngLat.convert](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/#convert>) to convert arrays to `LngLat` values.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `input` | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) | An array of two coordinates to convert, or a `LngLatBounds` object to return. |

#### Returns

`LngLatBounds`

A new `LngLatBounds` object, if a conversion occurred, or the original `LngLatBounds` object.

#### Example

```ts
let arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
let llb = LngLatBounds.convert(arr); // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
```

---

### fromLngLat()

> `static` **fromLngLat**(`center`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>), `radius?`: `number`): `LngLatBounds`

Defined in: [geo/lng\_lat\_bounds.ts:382](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/lng_lat_bounds.ts#L382>)

Returns a `LngLatBounds` from the coordinates extended by a given `radius`. The returned `LngLatBounds` completely contains the `radius`.

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `center` | [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) | `undefined` | center coordinates of the new bounds. |
| `radius` | `number` | `0` | Distance in meters from the coordinates to extend the bounds. |

#### Returns

`LngLatBounds`

A new `LngLatBounds` object representing the coordinates extended by the `radius`.

#### Example

```ts
let center = new LngLat(-73.9749, 40.7736);
LngLatBounds.fromLngLat(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
```
