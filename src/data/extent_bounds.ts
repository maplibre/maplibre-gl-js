import Point from '@mapbox/point-geometry';
import {Bounds, type ReadOnlyBounds} from '../geo/bounds.ts';
import {EXTENT} from './extent.ts';

/**
 * The bounding box covering the entire extent of a tile.
 */
export const EXTENT_BOUNDS = Bounds.fromPoints([new Point(0, 0), new Point(EXTENT, EXTENT)]) as ReadOnlyBounds;