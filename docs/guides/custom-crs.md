# Custom Planar Coordinate Reference Systems

MapLibre GL JS renders Web Mercator (EPSG:3857) tiles by default. Some tile sets are published in a different planar coordinate reference system (CRS): national grids such as NZTM2000 (EPSG:2193), polar stereographic grids for the Arctic and Antarctic, or a plain image plane for floor plans, game maps and scanned artwork. `addProjection` registers such a CRS so a map can render tiles that were pre-projected in it, with the map's lng/lat API working as usual on top.

The map does not reproject tile content. It positions the tile grid registered with the CRS on screen and converts lng/lat to and from that grid through the converter you supply. Reprojecting tiles from another grid, such as Mercator tiles, into the CRS is tracked in [maplibre/maplibre#491](https://github.com/maplibre/maplibre/issues/491).

`addProjection`, `removeProjection`, `CRS`, the workers' `setProjectionHandler`, the built-in `identity` projection and the `{bbox}` token are experimental, so they can still change in a minor release.

## What is supported

A registered CRS comes with a square, power-of-two quad tile grid laid over its plane, the shape the OGC Two Dimensional Tile Matrix Set standard calls a quad tree tile matrix set. Tile 0/0/0 is one square, every zoom level splits each tile into four, and every tile source of the map is taken to serve tiles in that grid. Within that fence:

- The map has exactly one CRS at a time, selected by the style's `projection.type` or `map.setProjection({type: name})`.
- There are no world copies and no antimeridian wrap: the map renders a single world whatever `renderWorldCopies` is set to, and coordinates never wrap.
- The map is always flat. There is no globe transition from a registered CRS.
- Mercator behavior is untouched. Registering a CRS changes nothing until a map selects it.

## Defining a CRS

`addProjection` takes a `CRS`:

| Field | Meaning |
|-------|---------|
| `name` | The name used in `projection.type`, for example `'EPSG:2193'` or `'custom:floor-plan'`. It needs a colon: names without one, like `'mercator'`, `'globe'`, `'vertical-perspective'` and `'identity'`, are reserved for built-in projections. |
| `projection` | Converts between lng/lat degrees and CRS coordinates: `forward([lng, lat])` returns `[x, y]`, for example meters easting/northing, and `inverse([x, y])` returns `[lng, lat]`. A proj4js converter such as `proj4('EPSG:4326', 'EPSG:2193')` has this shape, and deck.gl's custom projection view takes the same object. Where `inverse` has no answer, it may return `null`, values that are not finite, or a position `forward` does not take back, or throw, as proj4 does past the edge of world projections. The map then uses the edge of the answers on the line to the center of the tile matrix set, assuming they form one stretch from the center outwards, so center the tile matrix set on a world projection's world, and a gesture there zooms around the center, as it does above the horizon of a pitched map. |
| `tileMatrixSet.origin` | The CRS coordinates `[x, y]` of the top-left corner of tile 0/0/0, its minimum x and maximum y, in the order `projection.forward` returns. |
| `tileMatrixSet.extentAtZoom0` | The width, and height, of tile 0/0/0 in CRS units. |
| `definition` | Optional. The CRS as a string the workers' projection handler accepts, such as WKT or a PROJ string. GeoJSON sources need it, see [GeoJSON sources](#geojson-sources). |

CRS units are taken as meters wherever the map converts meters: altitudes, elevations and the camera distance. That is right for a projected CRS in meters; for the degree-based `identity` projection it means "one unit". The map's center stays inside the tile 0/0/0 square and the zoom is limited only by `minZoom`, since the square is the grid the tile matrix set picked and can be much larger than the area of interest or narrower than the window. Set `maxBounds` to keep the whole view inside an area.

Internally the map works in world coordinates: the unit square that tile 0/0/0 covers and that the quad tree subdivides. A CRS position maps to it as:

```
worldX = (crsX - origin[0]) / extentAtZoom0
worldY = (origin[1] - crsY) / extentAtZoom0
```

World y grows downwards, like tile rows do, which is why `origin` is the top-left corner. Web Mercator expressed in these terms has `projection` = spherical Mercator meters, `origin` = `[-πR, πR]` and `extentAtZoom0` = `2πR` with `R` = 6378137, which is a useful sanity check when you derive numbers from a tile matrix set document.

Take `origin` and `extentAtZoom0` from the tile matrix set definition published with the tiles, never from the CRS's area of use. The numbers in your tile server's definition are the ones that count. Tile matrix set documents may list corners northing-first (LINZ's NZTM2000Quad does), so reorder them to `[easting, northing]`.

Two complete pages to start from: [Display a map in a polar stereographic projection](../examples/display-a-map-in-a-polar-stereographic-projection.md) (EPSG:3413, NASA GIBS imagery through the `{bbox}` token) and [Display a map in UTM zone 32N](../examples/display-a-map-in-utm-zone-32n.md) (EPSG:25832, a national mapping agency's WMTS). Swap in the proj4 definition, the tile matrix set and the tile URL of your own service.

## Example: NZTM2000 (EPSG:2193) with proj4js

[Land Information New Zealand (LINZ)](https://basemaps.linz.govt.nz/) serves its basemaps in the NZTM2000Quad tile matrix set, a quad tree grid over EPSG:2193. The projection math comes from [proj4js](https://proj4js.org/), so the page needs `proj4` loaded alongside `maplibre-gl`. The LINZ endpoint needs an API key, which you can get from the LINZ Basemaps site.

```js
proj4.defs('EPSG:2193', '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs');

maplibregl.addProjection({
    name: 'EPSG:2193',
    // proj4js converts [lng, lat] to [easting, northing] for the definition above.
    projection: proj4('EPSG:4326', 'EPSG:2193'),
    tileMatrixSet: {
        // Top-left corner of tile 0/0/0 in NZTM2000Quad: easting, northing.
        origin: [-3260586.7284, 10438190.1652],
        // Width of tile 0/0/0 in meters.
        extentAtZoom0: 10018754.1714
    }
});

const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        projection: {type: 'EPSG:2193'},
        sources: {
            linz: {
                type: 'vector',
                tiles: ['https://basemaps.linz.govt.nz/v1/tiles/topographic/NZTM2000Quad/{z}/{x}/{y}.pbf?api=YOUR_KEY'],
                maxzoom: 15
            }
        },
        layers: [
            {id: 'background', type: 'background', paint: {'background-color': '#dfeaf5'}},
            {id: 'land', type: 'fill', source: 'linz', 'source-layer': 'landcover', paint: {'fill-color': '#e8efe0'}}
        ]
    },
    center: [174.78, -41.29],
    zoom: 6
});
```

Register the projection before constructing a map whose style selects it; a style that names an unregistered projection falls back to Mercator with a warning. The `source-layer` name above is illustrative; check the LINZ style for the layers the tile set contains.

Zoom levels are the CRS's own. Zoom 6 in NZTM2000Quad covers a different ground area than zoom 6 in Web Mercator, so `minzoom`, `maxzoom` and camera zooms need to be tuned for the tile matrix set rather than copied from a Mercator style.

## A grid whose level 0 has more than one tile

Some national grids start with several tiles at level 0. The Danish grid in EPSG:25832 is 3 by 2 tiles at level 0, and each level after it doubles. Register the smallest power-of-two square of level 0 tiles that holds the grid, here 4 by 4, so that map zoom 2 is the service's level 0. Then set `minzoom: 2` on the source, so the map never asks for the levels above it, and subtract 2 from the level in the tile URL with `transformRequest`:

```js
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

maplibregl.addProjection({
    name: 'EPSG:25832',
    projection: proj4('EPSG:4326', 'EPSG:25832'),
    // 4 by 4 tiles of the service's level 0, each 256 px at 1638.4 m per pixel, from the grid's top-left corner.
    tileMatrixSet: {origin: [120000, 6500000], extentAtZoom0: 4 * 256 * 1638.4}
});

const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        projection: {type: 'EPSG:25832'},
        sources: {
            denmark: {
                type: 'raster',
                // The service's WMTS template, with the level, row and column in the query string.
                tiles: ['https://example.com/wmts?SERVICE=WMTS&REQUEST=GetTile&TileMatrix={z}&TileRow={y}&TileCol={x}'],
                tileSize: 256,
                minzoom: 2
            }
        },
        layers: [{id: 'denmark', type: 'raster', source: 'denmark'}]
    },
    // Map zoom 2 is the service's level 0.
    transformRequest: url => ({url: url.replace(/TileMatrix=(\d+)/, (match, z) => `TileMatrix=${z - 2}`)})
});
```

## Example: an image plane with `identity`

The built-in `identity` projection uses lng/lat degrees unchanged as CRS coordinates: tile 0/0/0 spans -90..90 on both axes, and one unit is one meter. Coordinates go in as plain plane coordinates and come out without any latitude stretch, so an image placed by its four corners is shown undistorted:

```js
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        projection: {type: 'identity'},
        sources: {
            plan: {
                type: 'image',
                url: 'floor-plan.png',
                coordinates: [[-60, 40], [60, 40], [60, -40], [-60, -40]]
            }
        },
        layers: [{id: 'plan', type: 'raster', source: 'plan'}]
    },
    center: [0, 0],
    zoom: 0
});
```

The [Display an image in the identity projection](../examples/display-an-image-in-the-identity-projection.md) example shows this in a complete page. Unlike Leaflet's `CRS.Simple`, which is unbounded and in pixels, the plane is the fixed 180-unit square of tile 0/0/0 and coordinates are still lng/lat: anything outside -90..90 is never rendered, so scale an image's pixel coordinates into that range, or register your own identity CRS with a different `tileMatrixSet`.

## The `{bbox}` URL token

Tile servers that speak WMS or WMTS-style requests want each tile's bounding box rather than z/x/y. The `{bbox}` token in a `tiles` URL template expands to `minX,minY,maxX,maxY` in the map projection's CRS units, computed from the tile matrix set, with y pointing up as in the CRS itself:

```js
tiles: ['https://example.com/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG:2193&BBOX={bbox}&WIDTH=256&HEIGHT=256&LAYERS=topo&FORMAT=image/png']
```

`{bbox}` is x,y in the order your `projection.forward` returns (easting, northing); WMS 1.3.0 expects northing first for EPSG:2193 and EPSG:4326, so use `VERSION=1.1.1` with `SRS=`, which is always x,y, or reorder the values in a `transformRequest`.

On a Mercator map `{bbox}` expands to the same string as the existing `{bbox-epsg-3857}` token, which stays available and always means EPSG:3857 meters. `scheme: "tms"` flips only `{y}`; `{bbox}` always describes the tile the id names, as `{bbox-epsg-3857}` does.

## GeoJSON sources

A GeoJSON source's data is parsed and tiled in the map's web workers, where the CRS's `projection` object cannot go. Pass the CRS as a `definition` string too, and set a projection handler in the workers that builds the same converter from it. With proj4js the script that sets it is two lines:

```js
// projection-handler.mjs
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.15.0/+esm';
self.setProjectionHandler(definition => proj4(definition));
```

Load it into the workers before the map's sources load, and pass the same string to proj4 on the page:

```js
await maplibregl.importScriptInWorkers(new URL('projection-handler.mjs', location.href).href);

const nztm = '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs';
maplibregl.addProjection({
    name: 'EPSG:2193',
    definition: nztm,
    projection: proj4('EPSG:4326', nztm),
    tileMatrixSet: {origin: [-3260586.7284, 10438190.1652], extentAtZoom0: 10018754.1714}
});
```

The data stays in lng/lat: `getData`, `queryRenderedFeatures` and the cluster methods return lng/lat, and `setData` and `updateData` take it. Only the positions are projected, so the edges between them are straight in the grid, and a long edge needs more positions to follow its curve. Before projecting it, the source moves the positions that lie toward a pole past the latitude where the projection starts to stretch distances more than ten times as much as at the center of the grid onto that latitude, so that what the projection can't place, like the opposite pole of a polar projection, which projects to infinity, stays off the map. Projections that stretch neither pole that much, like UTM, keep every latitude. Data outside the tile matrix set is cut away, so it ends at the grid's edge like the tiles do. [Display GeoJSON in a polar stereographic projection](../examples/display-geojson-in-a-polar-stereographic-projection.md) puts it together in a complete page, with the handler's script inlined as a Blob. The built-in `identity` projection needs neither a `definition` nor a handler. Without a `definition`, or without a handler in the workers, a GeoJSON source logs a warning and is drawn in the wrong place.

## Custom layers

A custom layer's `defaultProjectionData` takes world coordinates, the unit square of tile 0/0/0 from [Defining a CRS](#defining-a-crs), the way it takes Mercator coordinates on a Mercator map. `MercatorCoordinate` still answers in Mercator, so compute positions from the object passed to `addProjection` instead:

```js
function toWorld(crs, [lng, lat], altitude = 0) {
    const [x, y] = crs.projection.forward([lng, lat]);
    const {origin, extentAtZoom0} = crs.tileMatrixSet;
    return [(x - origin[0]) / extentAtZoom0, (origin[1] - y) / extentAtZoom0, altitude / extentAtZoom0];
}
```

A meter is `1 / extentAtZoom0` world units everywhere in the grid, so a three.js model takes that as its scale where the Mercator examples use `meterInMercatorCoordinateUnits()`. Libraries that place things with `MercatorCoordinate`, or build their own camera from the map's center and zoom, need support for the CRS on their side.

## What keeps working

Everything that speaks lng/lat goes through the CRS's `projection`, so the map API is unchanged:

- `map.project`, `map.unproject`, `map.getBounds`, `fitBounds`, `flyTo` and markers all take and return lng/lat.
- `queryRenderedFeatures` and `querySourceFeatures` return GeoJSON in lng/lat.
- Terrain and hillshade render from DEM tiles served in the same grid. Hillshade applies no latitude correction, which is correct for a CRS in linear units.
- Image, video and canvas sources are placed by their four lng/lat corners.
- Vector and raster tile sources, including `bounds` and `minzoom`/`maxzoom`, work in the CRS's grid.

## What does not work

- Mixing CRSs. A Mercator tile source on an EPSG:2193 map, or a projected raster layer over Mercator base tiles, renders in the wrong place. Reprojecting tiles on the GPU is the subject of [maplibre/maplibre#491](https://github.com/maplibre/maplibre/issues/491).
- Non-quad tile matrix sets: grids whose levels are not powers of two, or whose tiles are not square. A grid whose level 0 has more than one tile works with the recipe above.
- Globe and world copies, as described above.
- Converters whose `inverse` does not undo `forward` inside the projection's area. The camera constraint and every query rely on the round trip being stable there.
- The `within` and `distance` expressions, which compute in mercator.
- Projection expressions. A registered projection only works as a plain name in `projection.type`: in an expression such as `['step', ['zoom'], 'EPSG:25832', 10, 'mercator']` it is ignored, and the map logs a warning and draws the globe projection.
- Switching to or from a registered CRS after the sources have loaded, with `setProjection` or with `setStyle` to a style in another projection, for now. Tile `bounds`, GeoJSON data and the corners of image, video and canvas sources are placed in the projection the map has when each source loads, so register the projection first and name it in the style, as the examples do.
- GeoJSON far from the central meridian of a transverse mercator, such as UTM or NZTM. More than 90 degrees from that meridian the projection puts the northern and southern hemispheres at opposite ends of the plane, so a polygon that crosses the equator there draws as a band across the map, as the Democratic Republic of the Congo from a world countries layer does on EPSG:2193. Leave out data on the far side of the world, with a filter or a smaller data set; the fix is the subject of [maplibre/maplibre-gl-js#8800](https://github.com/maplibre/maplibre-gl-js/issues/8800).

## Removing a projection

`removeProjection(name)` unregisters a CRS. A map currently using it keeps working until its projection changes. To replace a CRS, remove it and register the new one. Built-in projections, like `identity`, cannot be removed.
