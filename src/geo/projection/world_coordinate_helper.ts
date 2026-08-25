import {LngLat} from '../lng_lat.ts';
import {earthCircumference, MercatorCoordinate, latFromMercatorY, lngFromMercatorX, mercatorScale, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate.ts';

/**
 * @internal
 * Maps between geographic coordinates and the 0..1 world square that the tile
 * quad-tree subdivides. Transform and camera code goes through this seam instead of
 * calling the mercator functions directly, so a projection with a different planar
 * mapping can supply its own without touching the callers.
 *
 * The mapping does not have to be separable: `x` may depend on both `lng` and `lat`
 * and vice versa.
 */
export type WorldCoordinateHelper = {
    /**
     * lng/lat in degrees to a world square position with `z` at sea level; callers that need
     * an altitude set `z` from `worldZFromAltitude`.
     */
    worldFromLngLat(lng: number, lat: number): MercatorCoordinate;
    /**
     * World square coordinates to lng/lat.
     */
    lngLatFromWorld(x: number, y: number): LngLat;
    /**
     * Meters per world unit at a world position (mercator: the circumference at that latitude; planar: constant, arguments ignored).
     * Takes the world position because the camera-to-center iteration only has one; it avoids a lng/lat object per step.
     */
    metersPerWorldUnit(x: number, y: number): number;
    /**
     * Altitude in meters to world z at a location (mercator: `mercatorZfromAltitude(altitude, lat)`; planar: constant scale, argument ignored).
     */
    worldZFromAltitude(altitude: number, lngLat: LngLat): number;
};

/**
 * @internal
 * The Web Mercator world mapping used by the mercator, globe, and vertical-perspective projections.
 * `metersPerWorldUnit` is the inverse of `MercatorCoordinate.meterInMercatorCoordinateUnits`.
 */
export const mercatorWorldCoordinates: WorldCoordinateHelper = {
    worldFromLngLat(lng: number, lat: number): MercatorCoordinate {
        return new MercatorCoordinate(mercatorXfromLng(lng), mercatorYfromLat(lat));
    },
    lngLatFromWorld(x: number, y: number): LngLat {
        return new LngLat(lngFromMercatorX(x), latFromMercatorY(y));
    },
    metersPerWorldUnit(_x: number, y: number): number {
        return earthCircumference / mercatorScale(latFromMercatorY(y));
    },
    worldZFromAltitude(altitude: number, lngLat: LngLat): number {
        return mercatorZfromAltitude(altitude, lngLat.lat);
    },
};
