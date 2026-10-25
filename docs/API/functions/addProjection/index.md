# addProjection()

> **addProjection**(`crs`: [`CRS`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CRS/index.md>)): `void`

Defined in: [geo/projection/projection\_crud.ts:50](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/projection_crud.ts#L50>)

**`Experimental`**

Registers a planar coordinate reference system so it can be used as a map projection. After registration the CRS name is accepted, as a plain name, by the style's `projection.type` and by `map.setProjection({type: name})`. Every tile source of such a map is taken to be cut in the quad tile grid described by `tileMatrixSet`, and the map does not reproject tile content. The pre-registered `'identity'` projection is an identity CRS over lng/lat degrees, where tile 0/0/0 spans -90..90 on both axes. The name of a registered CRS needs a colon, like `'EPSG:2193'` or `'custom:floor-plan'`: names without one are reserved for built-in projections.

A map in a registered projection never renders world copies and never wraps across an antimeridian.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `crs` | [`CRS`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CRS/index.md>) | the CRS |

## Returns

`void`

## Throws

Error if the name has no colon, is already registered, or if `tileMatrixSet.extentAtZoom0` is not positive

## Example

```ts
// NZTM2000 (EPSG:2193) with the LINZ NZTM2000Quad tile matrix set, using proj4js for the math.
// The origin and extent below come from the NZTM2000Quad TileMatrixSet definition;
// copy them from that definition rather than from this example.
proj4.defs('EPSG:2193', '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs');
addProjection({
    name: 'EPSG:2193',
    projection: proj4('EPSG:4326', 'EPSG:2193'),
    tileMatrixSet: {
        origin: [-3260586.7284, 10438190.1652], // top-left of tile 0/0/0, from the NZTM2000Quad TileMatrixSet
        extentAtZoom0: 10018754.1714 // width of tile 0/0/0 in meters, from the NZTM2000Quad TileMatrixSet
    }
});
const map = new Map({
    container: 'map',
    style: {version: 8, projection: {type: 'EPSG:2193'}, sources: {}, layers: []}
});
```
