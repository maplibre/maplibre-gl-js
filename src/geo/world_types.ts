import type {LngLat} from './lng_lat.ts';
import type {MercatorCoordinate} from './mercator_coordinate.ts';
import type {TileMatrixSet} from './projection/tile_matrix_set.ts';

/**
 * @internal
 * Maps between geographic coordinates and the 0..1 world square that the tile
 * quad-tree subdivides. Transform and camera code goes through this seam instead of
 * calling the mercator functions directly, so a projection with a different planar
 * mapping only has to supply this.
 *
 * The mapping does not have to be separable: `x` may depend on both `lng` and `lat`
 * and vice versa.
 */
export interface WorldCoordinateHelper {
    /**
     * The name of the flat projection whose plane this is: `mercator`, or the `name` of a CRS registered
     * with `addProjection`.
     */
    name: string;
    /**
     * lng/lat in degrees and an altitude in meters to a world square position. `z` is
     * `worldZFromAltitude` of the altitude, and stays `0` when no altitude is given.
     */
    worldFromLngLat(lng: number, lat: number, altitude?: number): MercatorCoordinate;
    /**
     * World square coordinates to lng/lat.
     */
    lngLatFromWorld(x: number, y: number): LngLat;
    /**
     * Whether a world square position has a lng/lat of its own: everywhere for mercator, and for a planar CRS
     * wherever its inverse answers, which past the edge of a world projection it does not.
     */
    hasLngLat(x: number, y: number): boolean;
    /**
     * Meters per world unit at a world position (mercator: the circumference at that latitude; planar: constant, arguments ignored).
     * Takes the world position because the camera-to-center iteration only has one; it avoids a lng/lat object per step.
     */
    metersPerWorldUnit(x: number, y: number): number;
    /**
     * Altitude in meters to world z at a location (mercator: `mercatorZfromAltitude(altitude, lat)`; planar: constant scale, argument ignored).
     */
    worldZFromAltitude(altitude: number, lngLat: LngLat): number;
    /**
     * True for mercator only: the world wraps in longitude, gets world copies, and clamps latitude to the valid
     * mercator range. A planar CRS is a bounded square that does none of that.
     */
    wraps: boolean;
    /**
     * The quad tile matrix set whose tile 0/0/0 is the world square, in CRS units: EPSG:3857 meters for mercator, the
     * registered definition's `tileMatrixSet` for a planar CRS. The `{bbox}` tile URL token is expressed in it.
     */
    tileMatrixSet: TileMatrixSet;
}

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
