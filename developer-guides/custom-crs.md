# Custom planar CRS internals

This is the internal counterpart to the [Custom Planar Coordinate Reference Systems](../docs/guides/custom-crs.md) user guide. It describes the seam that lets a `Map` render tiles in a planar CRS other than Web Mercator without touching the rendering pipeline.

## The seam: `WorldCoordinateHelper`

The transform, camera, covering tiles, terrain, sources and queries used to call `MercatorCoordinate.fromLngLat`, `mercatorXfromLng`, `mercatorZfromAltitude` and friends directly. Those calls now go through a `WorldCoordinateHelper`:

- `worldFromLngLat(lng, lat, altitude?)` and `lngLatFromWorld(x, y)` map between lng/lat and world coordinates, the unit square that tile 0/0/0 covers and that the quad tree subdivides. `MercatorCoordinate` stays the container type for a world position; `z` is the altitude in world units, and stays `0` when no altitude is given.
- `metersPerWorldUnit(x, y)` is the local scale at a world position, used by the camera-to-center search and terrain skirts. Mercator returns the latitude-dependent value; a planar CRS returns a constant (`extentAtZoom0`, its units taken as meters) and ignores the arguments.
- `worldZFromAltitude(altitude, lngLat)` is the same idea for the vertical axis: an altitude in meters to world z.
- `wraps` is `true` only for Mercator. It gates world copies, `LngLat.wrap()`, antimeridian handling, the `MAX_VALID_LATITUDE` clamp and the hillshade latitude correction. With a non-wrapping helper `MercatorTransform._constrainToWorldSquare` clamps the camera to tile 0/0/0, or to the `maxBounds` box inside it.
- `tileMatrix` is the grid whose tile 0/0/0 is the world square, in CRS units, which the `{bbox}` tile URL token is expressed in; EPSG:3857 meters for Mercator.

A `CrsDefinition` becomes a helper through `new CrsWorldCoordinateHelper(definition)`, which applies the world-coordinate formula from the user guide.

## Who holds the helper

The projection factory checks the registry populated by `addProjection` before its built-in switch. For a registered CRS it builds one `CrsWorldCoordinateHelper` and gives it to both halves of the map's projection: the `MercatorProjection` it constructs, and the `MercatorTransform`, through `setWorldCoordinateHelper`, which `clone()` carries along. Mercator, globe and vertical-perspective share the one mercator helper.

Readers take the helper from what they already hold: the transform, camera and covering tiles from the transform; sources and queries from `map.style.projection.worldCoordinateHelper`; the terrain from a reader the `Map` passes it, since the painter holds no transform.

A registered CRS shares the mercator shader variant, prelude and tile mesh. A tile's own coordinates are already in the CRS's quad grid, so tiles are drawn exactly as mercator tiles are, and only the lng/lat mapping around the edges differs.

## Why Mercator keeps its own functions

Mercator does not go through the generic CRS formula. Its helper calls the existing `mercatorXfromLng`/`mercatorYfromLat` functions with the same arguments the transform used before the seam existed, and a unit test pins the transform's outputs against values captured from the code without the seam. The one known difference is `calculateCenterFromCameraLngLatAlt`, which without the seam seeds its center search with `altitudeFromMercatorZ` and iterates with `meterInMercatorCoordinateUnits`, which round the same number differently; the helper has one method for it, so the result can differ in its last bits. When you touch a transform call site, feed the helper the same value the old code used rather than a value that would need a round trip through lng/lat.

## Hillshade

The hillshade shader scales slopes by `cos(lat)` to undo Mercator's latitude stretch, with the tile's latitude range passed as `u_latrange`. `getTileLatRange` returns `[0, 0]` for a non-wrapping projection: `cos(0)` is 1, so a CRS in linear units gets no correction and the shader stays unchanged.

## Not yet: GeoJSON

The worker tiles GeoJSON with `geojson-vt`, which projects with its own Mercator, so GeoJSON data does not follow a registered CRS yet. The design for it is discussed in [#168](https://github.com/maplibre/maplibre-gl-js/issues/168).

## Fence

Square, power-of-two quad tile grids only; one CRS per map; no world copies, no wrap, no globe transition. Anything beyond that, most of all reprojecting Mercator tile content, belongs to the [GPU reprojection discussion](https://github.com/maplibre/maplibre/issues/491).
