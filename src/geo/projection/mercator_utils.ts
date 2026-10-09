import {mat4} from 'gl-matrix';
import {EXTENT} from '../../data/extent.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, zoomScale, type Mat4f64} from '../../util/util.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import Point from '@mapbox/point-geometry';

import type {WorldCoordinateHelper} from '../transform_interface.ts';
import type {UnwrappedTileIDType} from '../transform_helper.ts';
import type {LngLat} from '../lng_lat.ts';

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
 * Convert from LngLat to world coordinates (the projection's 0..1 world square scaled by world size).
 * @param worldSize - World size computed from zoom level and tile size.
 * @param lnglat - The location to convert.
 * @param helper - The lng/lat to world mapping; latitude is clamped to the valid mercator range only for a wrapping (mercator) helper.
 * @returns Point
 */
export function projectToWorldCoordinates(worldSize: number, lnglat: LngLat, helper: WorldCoordinateHelper): Point {
    const lat = helper.wraps ? clamp(lnglat.lat, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE) : lnglat.lat;
    const {x, y} = helper.worldFromLngLat(lnglat.lng, lat);
    return new Point(x * worldSize, y * worldSize);
}

/**
 * Convert from world coordinates (the projection's 0..1 world square scaled by world size) to LngLat.
 * @param worldSize - World size computed from zoom level and tile size.
 * @param point - World coordinate.
 * @param helper - The lng/lat to world mapping.
 * @returns LngLat
 */
export function unprojectFromWorldCoordinates(worldSize: number, point: Point, helper: WorldCoordinateHelper): LngLat {
    return helper.lngLatFromWorld(point.x / worldSize, point.y / worldSize);
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

export function calculateTileMatrix(unwrappedTileID: UnwrappedTileIDType, worldSize: number): Mat4f64 {
    const canonical = unwrappedTileID.canonical;
    const scale = worldSize / zoomScale(canonical.z);
    const unwrappedX = canonical.x + Math.pow(2, canonical.z) * unwrappedTileID.wrap;

    const worldMatrix: Mat4f64 = new Float64Array(16);
    mat4.identity(worldMatrix);
    mat4.translate(worldMatrix, worldMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
    mat4.scale(worldMatrix, worldMatrix, [scale / EXTENT, scale / EXTENT, 1]);
    return worldMatrix;
}

/**
 * Returns the camera position for a center already mapped to world coordinates.
 * Callers resolve the center through the transform's `WorldCoordinateHelper`; keeping the helper
 * out of this function lets the engine inline it on the per-frame camera path.
 * @param centerMercator - the center in world coordinates, with its elevation in `z`
 * @param dMercator - camera to center distance in world units
 */
export function cameraMercatorCoordinateFromCenterAndRotation(centerMercator: MercatorCoordinate, pitch: number, bearing: number, dMercator: number): MercatorCoordinate {
    const {x, y, z} = cameraDirectionFromPitchBearing(pitch, bearing);
    const dxMercator = dMercator * -x;
    const dyMercator = dMercator * -y;
    // Unlike x and y, z already points from the center up towards the camera.
    const dzMercator = dMercator * z;
    return new MercatorCoordinate(centerMercator.x + dxMercator, centerMercator.y + dyMercator, centerMercator.z + dzMercator);
}

/**
 * Returns the position of the camera in mercator coordinates, with its altitude in `z`.
 * Computed from the center, pitch, bearing and camera distance, so it holds for any projection.
 * @param center - The center to compute from, the transform's own by default.
 */
export function cameraMercatorCoordinate(transform: {
    center: LngLat;
    elevation: number;
    pitch: number;
    bearing: number;
    cameraToCenterDistance: number;
    worldSize: number;
    worldCoordinateHelper: WorldCoordinateHelper;
}, center: LngLat = transform.center): MercatorCoordinate {
    const worldCoordinateHelper = transform.worldCoordinateHelper;
    const mercUnitsPerMeter = worldCoordinateHelper.worldZFromAltitude(1, center);
    const pixelPerMeter = mercUnitsPerMeter * transform.worldSize;
    const distance = transform.cameraToCenterDistance / pixelPerMeter;
    const centerMercator = worldCoordinateHelper.worldFromLngLat(center.lng, center.lat, transform.elevation);
    return cameraMercatorCoordinateFromCenterAndRotation(centerMercator, transform.pitch, transform.bearing, distance * mercUnitsPerMeter);
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

/**
 * The number of steps a lng/lat box is cut into along each axis by {@link lngLatBoxToWorldSamples}.
 */
const BOX_SAMPLE_STEPS = 16;

/**
 * Projects a lng/lat box into the world square as a grid of points, {@link BOX_SAMPLE_STEPS} + 1 on a side,
 * edges and corners included. The corners alone miss most of a box whose edges curve, as a parallel does
 * around a pole, and the inside of the box matters where the projection runs off to infinity, as transverse
 * mercator does on the equator 90 degrees from its central meridian.
 * `bulge` is the farthest an edge strays from the line between two neighboring points, measured halfway
 * between them, which bounds how far an edge reaches past the points. It is 0 where every edge projects to
 * a straight line, as in mercator.
 */
export function lngLatBoxToWorldSamples(worldCoordinateHelper: WorldCoordinateHelper, west: number, south: number, east: number, north: number): {points: Point[]; bulge: number} {
    const toPoint = (lng: number, lat: number) => {
        const {x, y} = worldCoordinateHelper.worldFromLngLat(lng, lat);
        return new Point(x, y);
    };
    const lngAt = (step: number) => step === BOX_SAMPLE_STEPS ? east : west + (east - west) * step / BOX_SAMPLE_STEPS;
    const latAt = (step: number) => step === BOX_SAMPLE_STEPS ? south : north + (south - north) * step / BOX_SAMPLE_STEPS;
    const points: Point[] = [];
    for (let row = 0; row <= BOX_SAMPLE_STEPS; row++) {
        for (let column = 0; column <= BOX_SAMPLE_STEPS; column++) {
            points.push(toPoint(lngAt(column), latAt(row)));
        }
    }
    const pointAt = (row: number, column: number) => points[row * (BOX_SAMPLE_STEPS + 1) + column];
    let bulge = 0;
    for (let step = 0; step < BOX_SAMPLE_STEPS; step++) {
        const lngHalfway = (lngAt(step) + lngAt(step + 1)) / 2;
        const latHalfway = (latAt(step) + latAt(step + 1)) / 2;
        const edges: Array<[Point, Point, Point]> = [
            [pointAt(0, step), pointAt(0, step + 1), toPoint(lngHalfway, north)],
            [pointAt(BOX_SAMPLE_STEPS, step), pointAt(BOX_SAMPLE_STEPS, step + 1), toPoint(lngHalfway, south)],
            [pointAt(step, 0), pointAt(step + 1, 0), toPoint(west, latHalfway)],
            [pointAt(step, BOX_SAMPLE_STEPS), pointAt(step + 1, BOX_SAMPLE_STEPS), toPoint(east, latHalfway)],
        ];
        for (const [start, end, halfway] of edges) {
            const chord = end.sub(start);
            const toHalfway = halfway.sub(start);
            const chordLength = chord.mag();
            const distance = chordLength > 0 ? Math.abs(chord.x * toHalfway.y - chord.y * toHalfway.x) / chordLength : toHalfway.mag();
            if (distance > bulge) bulge = distance;
        }
    }
    return {points, bulge};
}

/**
 * Projects a lng/lat box into the world square and returns the axis-aligned rectangle that contains it:
 * the rectangle around {@link lngLatBoxToWorldSamples}, grown by their bulge. In mercator that is exactly
 * the rectangle of the projected corners.
 */
export function lngLatBoxToWorldBox(worldCoordinateHelper: WorldCoordinateHelper, west: number, south: number, east: number, north: number): {minX: number; minY: number; maxX: number; maxY: number} {
    const {points, bulge} = lngLatBoxToWorldSamples(worldCoordinateHelper, west, south, east, north);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const {x, y} of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return {minX: minX - bulge, minY: minY - bulge, maxX: maxX + bulge, maxY: maxY + bulge};
}

/**
 * Maps the four corners of a world rectangle back to lng/lat and returns the box that contains them.
 * That is exact in mercator. Where `x` and `y` both depend on `lng` and `lat` it can miss a curved edge
 * or a pole inside the rectangle; its one caller is the GeoJSON reload check, and GeoJSON does not follow
 * a registered CRS yet.
 */
export function worldBoxToLngLatBox(worldCoordinateHelper: WorldCoordinateHelper, minX: number, minY: number, maxX: number, maxY: number): {west: number; south: number; east: number; north: number} {
    const corners = [
        worldCoordinateHelper.lngLatFromWorld(minX, minY),
        worldCoordinateHelper.lngLatFromWorld(maxX, minY),
        worldCoordinateHelper.lngLatFromWorld(maxX, maxY),
        worldCoordinateHelper.lngLatFromWorld(minX, maxY),
    ];
    return {
        west: Math.min(corners[0].lng, corners[1].lng, corners[2].lng, corners[3].lng),
        south: Math.min(corners[0].lat, corners[1].lat, corners[2].lat, corners[3].lat),
        east: Math.max(corners[0].lng, corners[1].lng, corners[2].lng, corners[3].lng),
        north: Math.max(corners[0].lat, corners[1].lat, corners[2].lat, corners[3].lat),
    };
}
