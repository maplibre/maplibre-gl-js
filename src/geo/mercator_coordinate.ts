import {vec3} from 'gl-matrix';
import {LngLat, earthRadius} from '../geo/lng_lat';
import type {LngLatLike} from '../geo/lng_lat';
import {IMercatorCoordinate} from '@maplibre/maplibre-gl-style-spec';

/*
 * The average circumference of the world in meters.
 */
const earthCircumfrence = 2 * Math.PI * earthRadius; // meters

/*
 * The circumference at a line of latitude in meters.
 */
function circumferenceAtLatitude(latitude: number) {
    return earthCircumfrence * Math.cos(latitude * Math.PI / 180);
}

export function mercatorXfromLng(lng: number) {
    return (180 + lng) / 360;
}

export function mercatorYfromLat(lat: number) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

export function mercatorZfromAltitude(altitude: number, lat: number) {
    return altitude / circumferenceAtLatitude(lat);
}

export function lngFromMercatorX(x: number) {
    return x * 360 - 180;
}

export function latFromMercatorY(y: number) {
    const y2 = 180 - y * 360;
    return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
}

export function altitudeFromMercatorZ(z: number, y: number) {
    return z * circumferenceAtLatitude(latFromMercatorY(y));
}

/**
 * Returns the 3D point on a unit sphere for a given web mercator coordinate.
 * @param tileX Mercator X coordinate, in range 0..2^zoom. Can be fractional.
 * @param tileY Mercator Y coordinate, in range 0..2^zoom. Can be fractional.
 * @param zoom Mercator zoom level, determines the range for `tileX` and `tileY`
 * @returns The 3D vector pointing to the point on unit sphere specified by the mercator coordinates.
 */
export function webMercatorToSpherePoint(tileX: number, tileY: number, zoom: number): vec3 {
    const tileAngularSizeX = Math.PI * 2 / (1 << zoom);
    // get the "latitude and longitude" on a perfect sphere for the given mercator tile coordinates
    const angleE = -Math.PI + tileAngularSizeX * tileX;
    const sphericalAngleN = 2.0 * Math.atan(Math.exp(Math.PI - (tileY * Math.PI * 2.0 / (1 << zoom)))) - Math.PI * 0.5;

    const len = Math.cos(sphericalAngleN);

    return [
        Math.sin(angleE) * len,
        Math.sin(sphericalAngleN),
        Math.cos(angleE) * len
    ];
}

/**
 * Determine the Mercator scale factor for a given latitude, see
 * https://en.wikipedia.org/wiki/Mercator_projection#Scale_factor
 *
 * At the equator the scale factor will be 1, which increases at higher latitudes.
 *
 * @param lat - Latitude
 * @returns scale factor
 */
export function mercatorScale(lat: number) {
    return 1 / Math.cos(lat * Math.PI / 180);
}

/**
 * A `MercatorCoordinate` object represents a projected three dimensional position.
 *
 * `MercatorCoordinate` uses the web mercator projection ([EPSG:3857](https://epsg.io/3857)) with slightly different units:
 * - the size of 1 unit is the width of the projected world instead of the "mercator meter"
 * - the origin of the coordinate space is at the north-west corner instead of the middle
 *
 * For example, `MercatorCoordinate(0, 0, 0)` is the north-west corner of the mercator world and
 * `MercatorCoordinate(1, 1, 0)` is the south-east corner. If you are familiar with
 * [vector tiles](https://github.com/mapbox/vector-tile-spec) it may be helpful to think
 * of the coordinate space as the `0/0/0` tile with an extent of `1`.
 *
 * The `z` dimension of `MercatorCoordinate` is conformal. A cube in the mercator coordinate space would be rendered as a cube.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let nullIsland = new maplibregl.MercatorCoordinate(0.5, 0.5, 0);
 * ```
 * @see [Add a custom style layer](https://maplibre.org/maplibre-gl-js/docs/examples/custom-style-layer/)
 */
export class MercatorCoordinate implements IMercatorCoordinate {
    x: number;
    y: number;
    z: number;

    /**
     * @param x - The x component of the position.
     * @param y - The y component of the position.
     * @param z - The z component of the position.
     */
    constructor(x: number, y: number, z: number = 0) {
        this.x = +x;
        this.y = +y;
        this.z = +z;
    }

    /**
     * Project a `LngLat` to a `MercatorCoordinate`.
     *
     * @param lngLatLike - The location to project.
     * @param altitude - The altitude in meters of the position.
     * @returns The projected mercator coordinate.
     * @example
     * ```ts
     * let coord = maplibregl.MercatorCoordinate.fromLngLat({ lng: 0, lat: 0}, 0);
     * coord; // MercatorCoordinate(0.5, 0.5, 0)
     * ```
     */
    static fromLngLat(lngLatLike: LngLatLike, altitude: number = 0): MercatorCoordinate {
        const lngLat = LngLat.convert(lngLatLike);

        return new MercatorCoordinate(
            mercatorXfromLng(lngLat.lng),
            mercatorYfromLat(lngLat.lat),
            mercatorZfromAltitude(altitude, lngLat.lat));
    }

    /**
     * Returns the `LngLat` for the coordinate.
     *
     * @returns The `LngLat` object.
     * @example
     * ```ts
     * let coord = new maplibregl.MercatorCoordinate(0.5, 0.5, 0);
     * let lngLat = coord.toLngLat(); // LngLat(0, 0)
     * ```
     */
    toLngLat() {
        return new LngLat(
            lngFromMercatorX(this.x),
            latFromMercatorY(this.y));
    }

    /**
     * Returns the altitude in meters of the coordinate.
     *
     * @returns The altitude in meters.
     * @example
     * ```ts
     * let coord = new maplibregl.MercatorCoordinate(0, 0, 0.02);
     * coord.toAltitude(); // 6914.281956295339
     * ```
     */
    toAltitude(): number {
        return altitudeFromMercatorZ(this.z, this.y);
    }

    /**
     * Returns the distance of 1 meter in `MercatorCoordinate` units at this latitude.
     *
     * For coordinates in real world units using meters, this naturally provides the scale
     * to transform into `MercatorCoordinate`s.
     *
     * @returns Distance of 1 meter in `MercatorCoordinate` units.
     */
    meterInMercatorCoordinateUnits(): number {
        // 1 meter / circumference at equator in meters * Mercator projection scale factor at this latitude
        return 1 / earthCircumfrence * mercatorScale(latFromMercatorY(this.y));
    }
}
