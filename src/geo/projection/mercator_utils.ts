import {mat4} from 'gl-matrix';
import {EXTENT} from '../../data/extent';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, zoomScale} from '../../util/util';
import {MercatorCoordinate, mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import type {UnwrappedTileIDType} from '../transform_helper';
import type {LngLat} from '../lng_lat';

/*
* The maximum angle to use for the Mercator horizon. This must be less than 90
* to prevent errors in `MercatorTransform::_calcMatrices()`. It shouldn't be too close
* to 90, or the distance to the horizon will become very large, unnecessarily increasing
* the number of tiles needed to render the map.
*/
export const maxMercatorHorizonAngle = 89.25;

/**
 * Returns mercator coordinates in range 0..1 for given coordinates inside a specified tile.
 * @param inTileX - X coordinate in tile units - range [0..EXTENT].
 * @param inTileY - Y coordinate in tile units - range [0..EXTENT].
 * @param canonicalTileID - Tile canonical ID - mercator X, Y and zoom.
 * @returns Mercator coordinates of the specified point in range [0..1].
 */
export function tileCoordinatesToMercatorCoordinates(inTileX: number, inTileY: number, canonicalTileID: {x: number; y: number; z: number}): MercatorCoordinate {
    const scale = 1.0 / (1 << canonicalTileID.z);
    return new MercatorCoordinate(
        inTileX / EXTENT * scale + canonicalTileID.x * scale,
        inTileY / EXTENT * scale + canonicalTileID.y * scale
    );
}

/**
 * Returns LngLat for given in-tile coordinates and tile ID.
 * @param inTileX - X coordinate in tile units - range [0..EXTENT].
 * @param inTileY - Y coordinate in tile units - range [0..EXTENT].
 * @param canonicalTileID - Tile canonical ID - mercator X, Y and zoom.
 */
export function tileCoordinatesToLocation(inTileX: number, inTileY: number, canonicalTileID: {x: number; y: number; z: number}): LngLat {
    return tileCoordinatesToMercatorCoordinates(inTileX, inTileY, canonicalTileID).toLngLat();
}

/**
 * Convert from LngLat to world coordinates (Mercator coordinates scaled by world size).
 * @param worldSize - Mercator world size computed from zoom level and tile size.
 * @param lnglat - The location to convert.
 * @returns Point
 */
export function projectToWorldCoordinates(worldSize: number, lnglat: LngLat): Point {
    const lat = clamp(lnglat.lat, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE);
    return new Point(
        mercatorXfromLng(lnglat.lng) * worldSize,
        mercatorYfromLat(lat) * worldSize);
}

/**
 * Convert from world coordinates (mercator coordinates scaled by world size) to LngLat.
 * @param worldSize - Mercator world size computed from zoom level and tile size.
 * @param point - World coordinate.
 * @returns LngLat
 */
export function unprojectFromWorldCoordinates(worldSize: number, point: Point): LngLat {
    return new MercatorCoordinate(point.x / worldSize, point.y / worldSize).toLngLat();
}

/**
 * Calculate pixel height of the visible horizon in relation to map-center (e.g. height/2),
 * multiplied by a static factor to simulate the earth-radius.
 * The calculated value is the horizontal line from the camera-height to sea-level.
 * @returns Horizon above center in pixels.
 */
export function getMercatorHorizon(transform: {pitch: number; cameraToCenterDistance: number}): number {
    return transform.cameraToCenterDistance * Math.min(Math.tan(degreesToRadians(90 - transform.pitch)) * 0.85,
        Math.tan(degreesToRadians(maxMercatorHorizonAngle - transform.pitch)));
}

export function calculateTileMatrix(unwrappedTileID: UnwrappedTileIDType, worldSize: number): mat4 {
    const canonical = unwrappedTileID.canonical;
    const scale = worldSize / zoomScale(canonical.z);
    const unwrappedX = canonical.x + Math.pow(2, canonical.z) * unwrappedTileID.wrap;

    const worldMatrix = mat4.identity(new Float64Array(16) as any);
    mat4.translate(worldMatrix, worldMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
    mat4.scale(worldMatrix, worldMatrix, [scale / EXTENT, scale / EXTENT, 1]);
    return worldMatrix;
}

export function cameraMercatorCoordinateFromCenterAndRotation(center: LngLat, elevation: number, pitch: number, bearing: number, distance: number): MercatorCoordinate {
    const centerMercator = MercatorCoordinate.fromLngLat(center, elevation);
    const mercUnitsPerMeter = mercatorZfromAltitude(1, center.lat);
    const dMercator = distance * mercUnitsPerMeter;
    const {x, y, z} = cameraDirectionFromPitchBearing(pitch, bearing);
    const dxMercator = dMercator * -x;
    const dyMercator = dMercator * -y;
    const dzMercator = dMercator * -z;
    return new MercatorCoordinate(centerMercator.x + dxMercator, centerMercator.y + dyMercator, centerMercator.z + dzMercator);
}

export function cameraDirectionFromPitchBearing(pitch: number, bearing: number): {x: number; y: number; z: number} {
    const pitchRadians = degreesToRadians(pitch);
    const bearingRadians = degreesToRadians(bearing);
    const z = Math.cos(-pitchRadians);
    const h = Math.sin(pitchRadians);
    const x = h * Math.sin(bearingRadians);
    const y = -h * Math.cos(bearingRadians);
    return {x, y, z};
}
