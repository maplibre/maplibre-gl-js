# MercatorCoordinate

Defined in: [geo/mercator\_coordinate.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L81>)

A `MercatorCoordinate` object represents a projected three dimensional position.

`MercatorCoordinate` uses the web mercator projection ([EPSG:3857](<https://epsg.io/3857>)) with slightly different units:

- the size of 1 unit is the width of the projected world instead of the "mercator meter"
- the origin of the coordinate space is at the north-west corner instead of the middle

For example, `MercatorCoordinate(0, 0, 0)` is the north-west corner of the mercator world and `MercatorCoordinate(1, 1, 0)` is the south-east corner. If you are familiar with [vector tiles](<https://github.com/mapbox/vector-tile-spec>) it may be helpful to think of the coordinate space as the `0/0/0` tile with an extent of `1`.

The `z` dimension of `MercatorCoordinate` is conformal. A cube in the mercator coordinate space would be rendered as a cube.

## Example

```ts
let nullIsland = new MercatorCoordinate(0.5, 0.5, 0);
```

## See

- [Add a custom style layer](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-custom-style-layer/>)
- [Add a 3D model using three.js](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/>)
- [Add a simple custom layer on a globe](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-simple-custom-layer-on-a-globe/>)

## Implements

- `IMercatorCoordinate`

## Constructors

### Constructor

> **new MercatorCoordinate**(`x`: `number`, `y`: `number`, `z?`: `number`): `MercatorCoordinate`

Defined in: [geo/mercator\_coordinate.ts:91](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L91>)

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `x` | `number` | `undefined` | The x component of the position. |
| `y` | `number` | `undefined` | The y component of the position. |
| `z` | `number` | `0` | The z component of the position. |

#### Returns

`MercatorCoordinate`

## Methods

### meterInMercatorCoordinateUnits()

> **meterInMercatorCoordinateUnits**(): `number`

Defined in: [geo/mercator\_coordinate.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L156>)

Returns the distance of 1 meter in `MercatorCoordinate` units at this latitude.

For coordinates in real world units using meters, this naturally provides the scale to transform into `MercatorCoordinate`s.

#### Returns

`number`

Distance of 1 meter in `MercatorCoordinate` units.

#### Implementation of

`IMercatorCoordinate.meterInMercatorCoordinateUnits`

---

### toAltitude()

> **toAltitude**(): `number`

Defined in: [geo/mercator\_coordinate.ts:144](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L144>)

Returns the altitude in meters of the coordinate.

#### Returns

`number`

The altitude in meters.

#### Example

```ts
let coord = new MercatorCoordinate(0, 0, 0.02);
coord.toAltitude(); // 6914.281956295339
```

#### Implementation of

`IMercatorCoordinate.toAltitude`

---

### toLngLat()

> **toLngLat**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [geo/mercator\_coordinate.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L128>)

Returns the `LngLat` for the coordinate.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The `LngLat` object.

#### Example

```ts
let coord = new MercatorCoordinate(0.5, 0.5, 0);
let lngLat = coord.toLngLat(); // LngLat(0, 0)
```

#### Implementation of

`IMercatorCoordinate.toLngLat`

---

### fromLngLat()

> `static` **fromLngLat**(`lngLatLike`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), `altitude?`: `number`): `MercatorCoordinate`

Defined in: [geo/mercator\_coordinate.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/mercator_coordinate.ts#L109>)

Project a `LngLat` to a `MercatorCoordinate`.

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `lngLatLike` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | `undefined` | The location to project. |
| `altitude` | `number` | `0` | The altitude in meters of the position. |

#### Returns

`MercatorCoordinate`

The projected mercator coordinate.

#### Example

```ts
let coord = MercatorCoordinate.fromLngLat({ lng: 0, lat: 0}, 0);
coord; // MercatorCoordinate(0.5, 0.5, 0)
```
