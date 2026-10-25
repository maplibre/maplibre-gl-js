# CRS

> **CRS** = `object`

Defined in: [geo/projection/crs.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/crs.ts#L33>)

**`Experimental`**

Describes a planar coordinate reference system (CRS) together with the square, power-of-two quad tile grid laid over it, so a map can render tiles that were pre-projected in that CRS. Register one with [addProjection](<https://maplibre.org/maplibre-gl-js/docs/API/functions/addProjection/index.md>) and select it with the style's `projection.type` or `map.setProjection({type: name})`.

Every tile source of the map is taken to be cut in `tileMatrixSet`, and the tiles are used as they are, without reprojecting their content. The map positions that grid on screen and maps lng/lat to and from it through `projection`. CRS units are taken as meters wherever the map converts meters: altitudes, elevations, and the camera distance.

## Properties

### definition?

> `optional` **definition?**: `string`

Defined in: [geo/projection/crs.ts:63](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/crs.ts#L63>)

The CRS as a string the workers' projection handler accepts, such as WKT or a PROJ string. GeoJSON sources need it: their data is parsed and tiled in the workers, where `projection` cannot go, so a handler set there builds the same converter from this string, see the custom CRS guide. Without it, GeoJSON sources warn and draw in the wrong place.

---

### name

> **name**: `string`

Defined in: [geo/projection/crs.ts:39](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/crs.ts#L39>)

Name used in `projection.type`, e.g. `'EPSG:2193'` or `'custom:floor-plan'`. It must contain a colon: names without one, like `'mercator'`, `'globe'`, `'vertical-perspective'` and the pre-registered `'identity'`, are reserved for built-in projections.

---

### projection

> **projection**: `object`

Defined in: [geo/projection/crs.ts:49](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/crs.ts#L49>)

Converts between lng/lat (degrees) and CRS coordinates (e.g. meters easting/northing): `forward([lng, lat])` returns `[x, y]` and `inverse([x, y])` returns `[lng, lat]`. This is the shape of a proj4 converter such as `proj4('EPSG:4326', 'EPSG:2193')`, which deck.gl's custom projection view takes as well. Where `inverse` has no answer, `null`, a value that is not finite, one that `forward` does not take back to the position, or an error, as proj4 gives past the edge of world projections, the map uses the edge of the answers on the line to the center of the tile matrix set. It assumes they form one stretch from the center outwards, so a world projection's tile matrix set should be centered on its world.

#### forward()

> **forward**(`position`: `number`\[\]): `number`\[\]

##### Parameters

| Parameter | Type |
| --- | --- |
| `position` | `number`\[\] |

##### Returns

`number`\[\]

#### inverse()

> **inverse**(`position`: `number`\[\]): `number`\[\]

##### Parameters

| Parameter | Type |
| --- | --- |
| `position` | `number`\[\] |

##### Returns

`number`\[\]

---

### tileMatrixSet

> **tileMatrixSet**: [`TileMatrixSet`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TileMatrixSet/index.md>)

Defined in: [geo/projection/crs.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/crs.ts#L56>)

The quad tile matrix set over the CRS plane.
