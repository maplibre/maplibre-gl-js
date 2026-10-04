# Display a map in a custom CRS

MapLibre draws Web Mercator by default. A map can instead use any planar coordinate reference system that has a square, power-of-two tile grid, such as UTM 33N for Norway or the polar EPSG:3413. Tiles are drawn in the grid they were cut in.

## Register the CRS

`addProjection` takes a name, a pair of functions between longitude/latitude and CRS coordinates, and the tile matrix. MapLibre does not include a projection library, so bring one; `proj4` is the usual choice.

```js
import {addProjection} from 'maplibre-gl';
import proj4 from 'proj4';

proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs');
const utm33 = proj4('EPSG:4326', 'EPSG:25833');

addProjection({
    name: 'EPSG:25833',
    project: (lng, lat) => utm33.forward([lng, lat]),
    unproject: (x, y) => utm33.inverse([x, y]),
    tileMatrix: {origin: [-2500000, 9045984], extentAtZoom0: 5545984}
});
```

Once registered, the name is accepted anywhere a projection type is: `map.setProjection({type: 'EPSG:25833'})` or `projection: {type: 'EPSG:25833'}` in the style.

## The tile matrix

`tileMatrix` describes how the CRS plane is cut into tiles. `origin` is the top-left corner of tile `0/0/0`, in the CRS coordinates `project` returns (easting, northing for a projected CRS). `extentAtZoom0` is the width, which is also the height, of that tile in the same units. Each zoom level splits every tile in four.

Take the values from the tile service's capabilities document. The CRS definition does not contain them, because the grid is the service's choice. Kartverket's `utm33n` tile matrix set, for example, starts at easting -2,500,000 and northing 9,045,984 with a zoom 0 tile 5,545,984 m wide. A WMTS `TileMatrixSet` gives these as `TopLeftCorner` and, through `ScaleDenominator` and `TileWidth`, the tile size at each level.

To cut vector tiles in the same grid with GDAL:

```sh
ogr2ogr -f MVT tiles input.geojson -dsco FORMAT=DIRECTORY \
    -dsco TILING_SCHEME=EPSG:25833,-2500000,9045984,5545984
```

## Load tiles

Vector, raster and raster DEM sources load unchanged: `{z}/{x}/{y}` are indexes into the tile matrix, and `scheme: 'tms'` flips `{y}` as it does for Mercator. A source's `bounds` are still in longitude/latitude; MapLibre projects them once when the source loads.

```js
map.addSource('topo', {
    type: 'raster',
    tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/utm33n/{z}/{y}/{x}.png'],
    tileSize: 256
});
```

Image, video and canvas sources place their corners through the CRS. Terrain, hillshade and `queryRenderedFeatures` follow the map's projection.

### Services that take a bounding box

A tile URL can contain `{bbox}` for services that address tiles by extent rather than by index, such as WMS. The token expands to the tile's bounds in CRS units, in the order `minX,minY,maxX,maxY`. On a Mercator map it expands to EPSG:3857, the same as `{bbox-epsg-3857}`.

```js
map.addSource('planning', {
    type: 'raster',
    tiles: [
        'https://example.com/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap' +
        '&LAYERS=planning&FORMAT=image/png&TRANSPARENT=true' +
        '&SRS=EPSG:25833&WIDTH=256&HEIGHT=256&BBOX={bbox}'
    ],
    tileSize: 256
});
```

With the UTM33 grid above, tile `13/3645/3414` expands to `BBOX=-32335,6734029,-31658,6734706`. The service must answer in the map's CRS. WMS 1.3.0 orders the axes by the CRS definition, which for many projected systems is northing first, so check the service before using the token with that version.

## What stays the same

Positions in and out of the API are longitude/latitude: `getCenter`, `setCenter`, `Marker.setLngLat`, `queryRenderedFeatures` geometries, `fitBounds`. Only the drawing happens in CRS coordinates. The compass points to the grid's north; at Bergen, UTM33 grid north is about 8.4 degrees west of true north.

## Limits

- A CRS map is a bounded plane: the camera stops at the edge of tile `0/0/0`, there are no world copies, and the globe projection is not available.
- GeoJSON sources are not yet supported on a CRS map. Cut vector tiles in the grid instead.
- Tiles must be cut in the map's grid. MapLibre does not reproject tiles, so a Web Mercator source cannot be shown on a UTM map.
