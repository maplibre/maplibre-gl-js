import Point from '@mapbox/point-geometry';
import {type Point2D} from '@maplibre/maplibre-gl-style-spec';
import {Bounds, type ReadOnlyBounds} from '../geo/bounds.ts';
import {EXTENT} from './extent.ts';

/**
 * The bounding box covering the entire extent of a tile.
 */
export const EXTENT_BOUNDS = Bounds.fromPoints([new Point(0, 0), new Point(EXTENT, EXTENT)]) as ReadOnlyBounds;

/**
 * Whether an edge runs along one of the lines the tile was cut out of the world at. Clipping happens
 * on the buffer rectangle, outside the tile, so an axis parallel edge out there belongs to the cut
 * rather than to the feature. Such an edge is shared with the neighbouring tile, which cuts the same
 * feature somewhere else, so geometry derived from it has to stay identical in both tiles.
 * @param p1 - First vertex of the edge
 * @param p2 - Second vertex of the edge
 * @returns True when the edge lies on a clip line.
 */
export function isBoundaryEdge(p1: Point2D, p2: Point2D): boolean {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}

/**
 * Whether a ring lies completely off one side of the tile, and so cannot contribute a visible pixel.
 * @param ring - Ring to test
 * @returns True when every vertex is beyond the same edge of the tile.
 */
export function isEntirelyOutside(ring: Point2D[]): boolean {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}