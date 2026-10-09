/**
 * A square, power-of-two quad tile matrix set laid over a planar CRS: tile 0/0/0 is the square of side
 * `extentAtZoom0` whose top-left corner is `origin`, and every zoom level splits each tile in four.
 */
export type TileMatrixSet = {
    /**
     * CRS coordinates of the top-left corner of tile 0/0/0 (min x, max y); x and y are in the order
     * the definition's `projection.forward` returns (easting, northing for a projected CRS).
     */
    origin: [number, number];
    /**
     * Width (= height) of tile 0/0/0 in CRS units.
     */
    extentAtZoom0: number;
};

/** WGS84 spherical radius used by EPSG:3857, distinct from the mean earth radius MercatorCoordinate is built on. */
const EPSG3857_RADIUS = 6378137;

/**
 * @internal
 * The EPSG:3857 tile matrix set in meters, the grid of the mercator, globe and vertical-perspective projections:
 * tile 0/0/0 spans half the circumference in every direction from the origin.
 */
export const mercatorTileMatrixSet: TileMatrixSet = {
    origin: [-Math.PI * EPSG3857_RADIUS, Math.PI * EPSG3857_RADIUS],
    extentAtZoom0: 2 * Math.PI * EPSG3857_RADIUS,
};
