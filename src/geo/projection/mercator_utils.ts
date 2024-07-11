import {mat4} from 'gl-matrix';
import {ProjectionData} from '../../render/program/projection_program';
import {EXTENT} from '../../data/extent';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id';
import {clamp} from '../../util/util';
import {MAX_VALID_LATITUDE} from '../transform_helper';
import {LngLat} from '../lng_lat';
import {MercatorCoordinate, mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';

/**
 * Returns mercator coordinates in range 0..1 for given coordinates inside a specified tile.
 * @param inTileX - X coordinate in tile units - range [0..EXTENT].
 * @param inTileY - Y coordinate in tile units - range [0..EXTENT].
 * @param canonicalTileID - Tile canonical ID - mercator X, Y and zoom.
 * @returns Mercator coordinates of the specified point in range [0..1].
 */
export function tileCoordinatesToMercatorCoordinates(inTileX: number, inTileY: number, canonicalTileID: CanonicalTileID): [number, number] {
    const scale = 1.0 / (1 << canonicalTileID.z);
    return [
        inTileX / EXTENT * scale + canonicalTileID.x * scale,
        inTileY / EXTENT * scale + canonicalTileID.y * scale
    ];
}

/**
 * Given a geographical lnglat, return an unrounded
 * coordinate that represents it at low zoom level.
 * @param lnglat - the location
 * @returns The mercator coordinate
 */
export function locationToMercatorCoordinate(lnglat: LngLat): MercatorCoordinate {
    return MercatorCoordinate.fromLngLat(lnglat);
}

/**
 * Given a Coordinate, return its geographical position.
 * @param coord - mercator coordinates
 * @returns lng and lat
 */
export function mercatorCoordinateToLocation(coord: MercatorCoordinate): LngLat {
    return coord && coord.toLngLat();
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
    return Math.tan(Math.PI / 2 - transform.pitch * Math.PI / 180.0) * transform.cameraToCenterDistance * 0.85;
}

/**
 * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
 * @param inViewportPixelUnitsUnits - True when the units accepted by the matrix are in viewport pixels instead of tile units.
 */
export function translatePosition(
    transform: { angle: number; zoom: number },
    tile: { tileID: OverscaledTileID; tileSize: number },
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    inViewportPixelUnitsUnits: boolean = false
): [number, number] {
    if (!translate[0] && !translate[1]) return [0, 0];

    const angle = inViewportPixelUnitsUnits ?
        (translateAnchor === 'map' ? transform.angle : 0) :
        (translateAnchor === 'viewport' ? -transform.angle : 0);

    if (angle) {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }

    return [
        inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], transform.zoom),
        inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], transform.zoom)];
}

export function getBasicProjectionData(overscaledTileID: OverscaledTileID, tilePosMatrix?: mat4, ignoreTerrainMatrix?: boolean): ProjectionData {
    let tileOffsetSize: [number, number, number, number];

    if (overscaledTileID) {
        const scale = (overscaledTileID.canonical.z >= 0) ? (1 << overscaledTileID.canonical.z) : Math.pow(2.0, overscaledTileID.canonical.z);
        tileOffsetSize = [
            overscaledTileID.canonical.x / scale,
            overscaledTileID.canonical.y / scale,
            1.0 / scale / EXTENT,
            1.0 / scale / EXTENT
        ];
    } else {
        tileOffsetSize = [0, 0, 1, 1];
    }

    let mainMatrix: mat4;
    if (overscaledTileID && overscaledTileID.terrainRttPosMatrix && !ignoreTerrainMatrix) {
        mainMatrix = overscaledTileID.terrainRttPosMatrix;
    } else if (tilePosMatrix) {
        mainMatrix = tilePosMatrix;
    } else {
        mainMatrix = mat4.create();
    }

    const data: ProjectionData = {
        'u_projection_matrix': mainMatrix, // Might be set to a custom matrix by different projections.
        'u_projection_tile_mercator_coords': tileOffsetSize,
        'u_projection_clipping_plane': [0, 0, 0, 0],
        'u_projection_transition': 0.0, // Range 0..1, where 0 is mercator, 1 is another projection, mostly globe.
        'u_projection_fallback_matrix': mainMatrix,
    };

    return data;
}
