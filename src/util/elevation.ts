/**
 * Samples the terrain elevation, in meters, at a point given in tile coordinates.
 *
 * Implementations are bound to a specific tile, so `x` and `y` are interpreted within that tile.
 * A missing function means the map has no terrain, in which case callers treat the elevation as 0.
 *
 * @param x - the x coordinate within the tile
 * @param y - the y coordinate within the tile
 * @returns the terrain elevation in meters
 */
export type GetElevation = (x: number, y: number) => number;
