import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from './util';
import {type LngLat} from '../geo/lng_lat';
import {MercatorCoordinate} from '../geo/mercator_coordinate';

/**
 * Returns true if a given tile zoom (Z), X, and Y are in the bounds of the world.
 * Zoom bounds are the minimum zoom (inclusive) through the maximum zoom (inclusive).
 * X and Y bounds are 0 (inclusive) to their respective zoom-dependent maxima (exclusive).
 *
 * @param zoom - the tile zoom (Z)
 * @param x - the tile X
 * @param y - the tile Y
 * @returns `true` if a given tile zoom, X, and Y are in the bounds of the world.
 */
export function isInBoundsForTileZoomXY(zoom: number, x: number, y: number): boolean {
    return !(
        zoom < MIN_TILE_ZOOM ||
        zoom > MAX_TILE_ZOOM ||
        y < 0 ||
        y >= Math.pow(2, zoom) ||
        x < 0 ||
        x >= Math.pow(2, zoom)
    );
}

/**
 * Returns true if a given zoom and `LngLat` are in the bounds of the world.
 * Does not wrap `LngLat` when checking if in bounds.
 * Zoom bounds are the minimum zoom (inclusive) through the maximum zoom (inclusive).
 * `LngLat` bounds are the mercator world's north-west corner (inclusive) to its south-east corner (exclusive).
 *
 * @param zoom - the tile zoom (Z)
 * @param LngLat - the `LngLat` object containing the longitude and latitude
 * @returns `true` if a given zoom and `LngLat` are in the bounds of the world.
 */
export function isInBoundsForZoomLngLat(zoom: number, lnglat: LngLat): boolean {
    const {x, y} = MercatorCoordinate.fromLngLat(lnglat);
    return !(
        zoom < MIN_TILE_ZOOM ||
        zoom > MAX_TILE_ZOOM ||
        y < 0 ||
        y >= 1 ||
        x < 0 ||
        x >= 1
    );
}
