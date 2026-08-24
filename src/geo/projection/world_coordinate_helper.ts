import {LngLat} from '../lng_lat.ts';
import {earthCircumference, latFromMercatorY, lngFromMercatorX, mercatorScale, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate.ts';

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
     * lng/lat in degrees to world square coordinates.
     */
    worldFromLngLat(lng: number, lat: number): {x: number; y: number};
    /**
     * World square coordinates to lng/lat.
     */
    lngLatFromWorld(x: number, y: number): LngLat;
    /**
     * Meters per world unit at a location (mercator: the circumference at that latitude; planar: constant, argument ignored).
     * Takes the location rather than a world position so mercator never round-trips y to latitude.
     */
    metersPerWorldUnit(lngLat: LngLat): number;
    /**
     * Altitude in meters to world z at a location (mercator: `mercatorZfromAltitude(altitude, lat)`; planar: constant scale, argument ignored).
     */
    worldZFromAltitude(altitude: number, lngLat: LngLat): number;
};

/**
 * @internal
 * The Web Mercator world mapping used by the mercator, globe, and vertical-perspective projections.
 * `metersPerWorldUnit` is the inverse of `MercatorCoordinate.meterInMercatorCoordinateUnits`, written the
 * same way so the camera-to-center iteration produces the same doubles it did when it called that method.
 */
export const mercatorWorldCoordinates: WorldCoordinateHelper = {
    worldFromLngLat(lng: number, lat: number): {x: number; y: number} {
        return {x: mercatorXfromLng(lng), y: mercatorYfromLat(lat)};
    },
    lngLatFromWorld(x: number, y: number): LngLat {
        return new LngLat(lngFromMercatorX(x), latFromMercatorY(y));
    },
    metersPerWorldUnit(lngLat: LngLat): number {
        return 1 / (1 / earthCircumference * mercatorScale(lngLat.lat));
    },
    worldZFromAltitude(altitude: number, lngLat: LngLat): number {
        return mercatorZfromAltitude(altitude, lngLat.lat);
    },
};
