# Custom Planar Coordinate Reference Systems

MapLibre GL JS renders Web Mercator (EPSG:3857) tiles by default. Some tile sets are published in a different planar coordinate reference system (CRS): national grids such as NZTM2000 (EPSG:2193), polar stereographic grids for the Arctic and Antarctic, or a plain image plane for floor plans, game maps and scanned artwork. `addProjection` registers such a CRS so a map can render tiles that were pre-projected in it, with the map's lng/lat API working as usual on top.

The map never reprojects tile content on the GPU. It positions the CRS's own tile grid on screen and converts lng/lat to and from that grid through the converter you supply. Reprojecting Mercator tiles into another CRS is a separate problem, tracked in [maplibre/maplibre#491](https://github.com/maplibre/maplibre/issues/491).

`addProjection`, `removeProjection` and `CrsDefinition` are experimental: they can still change in a minor release.

## What is supported

A registered CRS is a square, power-of-two quad tile grid laid over a plane, the shape the OGC Two Dimensional Tile Matrix Set standard calls a quad tree tile matrix set. Tile 0/0/0 is one square, every zoom level splits each tile into four, and every source of the map serves tiles in that grid. Within that fence:

- The map has exactly one CRS at a time, selected by `map.setProjection({type: name})` or the style's `projection.type`.
- There are no world copies and no antimeridian wrap: the map renders a single world whatever `renderWorldCopies` is set to, and coordinates never wrap.
- The map is always flat. There is no globe transition from a registered CRS; `setProjection({type: 'globe'})` swaps back to rendering Mercator tiles on the globe.
- Mercator behavior is untouched. Registering a CRS changes nothing until a map selects it.

## Defining a CRS

`addProjection` takes a `CrsDefinition`:

| Field | Meaning |
|-------|---------|
| `name` | The name used in `projection.type`, for example `'EPSG:2193'`. The built-in names `'mercator'`, `'globe'` and `'vertical-perspective'` are reserved. |
| `projection` | Converts between lng/lat degrees and CRS coordinates: `forward([lng, lat])` returns `[x, y]`, for example meters easting/northing, and `inverse([x, y])` returns `[lng, lat]`. A proj4js converter such as `proj4('EPSG:4326', 'EPSG:2193')` has this shape, and deck.gl's custom projection view takes the same object. |
| `tileMatrix.origin` | The CRS coordinates `[x, y]` of the top-left corner of tile 0/0/0, its minimum x and maximum y, in the order `projection.forward` returns. |
| `tileMatrix.extentAtZoom0` | The width, and height, of tile 0/0/0 in CRS units. |

CRS units are taken as meters wherever the map converts meters: altitudes, elevations and the camera distance. That is right for a projected CRS in meters; for the degree-based `simple` projection it means "one unit". The camera is constrained to the tile 0/0/0 square, or to `maxBounds` inside it.

Internally the map works in world coordinates: the unit square that tile 0/0/0 covers and that the quad tree subdivides. A CRS position maps to it as:

```
worldX = (crsX - origin[0]) / extentAtZoom0
worldY = (origin[1] - crsY) / extentAtZoom0
```

World y grows downwards, like tile rows do, which is why `origin` is the top-left corner. Web Mercator expressed in these terms has `projection` = spherical Mercator meters, `origin` = `[-πR, πR]` and `extentAtZoom0` = `2πR` with `R` = 6378137, which is a useful sanity check when you derive numbers from a tile matrix set document.

Take `origin` and `extentAtZoom0` from the tile matrix set definition published with the tiles, never from the CRS's area of use. The numbers in your tile server's definition are the ones that count. Tile matrix set documents may list corners northing-first (LINZ's NZTM2000Quad does), so reorder them to `[easting, northing]`.

## Example: NZTM2000 (EPSG:2193) with proj4js

[Land Information New Zealand (LINZ)](https://basemaps.linz.govt.nz/) serves its basemaps in the NZTM2000Quad tile matrix set, a quad tree grid over EPSG:2193. The projection math comes from [proj4js](https://proj4js.org/), so the page needs `proj4` loaded alongside `maplibre-gl`. The LINZ endpoint needs an API key, which you can get from the LINZ Basemaps site.

```js
proj4.defs('EPSG:2193', '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs');

maplibregl.addProjection({
    name: 'EPSG:2193',
    // proj4js converts [lng, lat] to [easting, northing] for the definition above.
    projection: proj4('EPSG:4326', 'EPSG:2193'),
    tileMatrix: {
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

## Example: an image plane with `simple`

The built-in `simple` projection is an identity CRS: CRS coordinates are lng/lat degrees, tile 0/0/0 spans -90..90 on both axes, and one unit is one meter. It is the equivalent of an image-space map. Coordinates go in as plain plane coordinates and come out without any latitude stretch, so an image placed by its four corners is shown undistorted:

```js
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        projection: {type: 'simple'},
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

The [Display an image in the simple projection](../examples/display-an-image-in-the-simple-projection.md) example shows this in a complete page. Coordinates outside -90..90 lie outside tile 0/0/0 and are never rendered; scale a larger coordinate space into that range, or register your own identity CRS with a different `tileMatrix`.

## The `{bbox}` URL token

Tile servers that speak WMS or WMTS-style requests want each tile's bounding box rather than z/x/y. The `{bbox}` token in a `tiles` URL template expands to `minX,minY,maxX,maxY` in the map projection's CRS units, computed from the tile matrix, with y pointing up as in the CRS itself:

```js
tiles: ['https://example.com/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG:2193&BBOX={bbox}&WIDTH=256&HEIGHT=256&LAYERS=topo&FORMAT=image/png']
```

`{bbox}` is x,y in the order your `projection.forward` returns (easting, northing); WMS 1.3.0 expects northing first for EPSG:2193 and EPSG:4326, so use `VERSION=1.1.1` with `SRS=`, which is always x,y, or reorder the values in a `transformRequest`.

On a Mercator map `{bbox}` expands to the same string as the existing `{bbox-epsg-3857}` token, which stays available and always means EPSG:3857 meters. `scheme: "tms"` flips only `{y}`; `{bbox}` always describes the tile the id names, as `{bbox-epsg-3857}` does.

## What keeps working

Everything that speaks lng/lat goes through the CRS definition's `projection`, so the map API is unchanged:

- `map.project`, `map.unproject`, `map.getBounds`, `fitBounds`, `flyTo` and markers all take and return lng/lat.
- `queryRenderedFeatures` and `querySourceFeatures` return GeoJSON in lng/lat.
- Terrain and hillshade render from DEM tiles served in the same grid. Hillshade applies no latitude correction, which is correct for a CRS in linear units.
- Image, video and canvas sources are placed by their four lng/lat corners.
- Vector and raster tile sources, including `bounds` and `minzoom`/`maxzoom`, work in the CRS's grid.

## What does not work

- GeoJSON sources, for now. Their data does not go through the projection yet, so on a map in a registered CRS it renders in the wrong place. Serve such data as vector tiles in the CRS's grid instead.
- Mixing CRSs. A Mercator tile source on an EPSG:2193 map, or a projected raster layer over Mercator base tiles, renders in the wrong place. Reprojecting tiles on the GPU is the subject of [maplibre/maplibre#491](https://github.com/maplibre/maplibre/issues/491).
- Non-quad tile matrix sets: grids whose zoom 0 is not a single square, whose levels are not powers of two, or whose tiles are not square.
- Globe and world copies, as described above.
- Converters whose `inverse` does not undo `forward`. The camera constraint and every query rely on the round trip being stable.

## Removing a projection

`removeProjection(name)` unregisters a CRS. A map currently using it keeps working until its projection changes. To replace a definition, remove it and register the new one.
