/**
 * A square, power-of-two quad tile grid laid over a planar CRS: tile 0/0/0 is the square of side
 * `extentAtZoom0` whose top-left corner is `origin`, and every zoom level splits each tile in four.
 */
export type TileMatrix = {
    /**
     * CRS coordinates of the top-left corner of tile 0/0/0 (min x, max y); x and y are in the order
     * `CrsDefinition.project` returns (easting, northing for a projected CRS).
     */
    origin: [number, number];
    /**
     * Width (= height) of tile 0/0/0 in CRS units.
     */
    extentAtZoom0: number;
};
