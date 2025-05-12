import Point from '@mapbox/point-geometry';
import {Bounds, type ReadOnlyBounds} from '../geo/bounds';
import {EXTENT} from './extent';

/**
 * The bounding box covering the entire extent of a tile.
 */
export const EXTENT_BOUNDS = Bounds.fromPoints([new Point(0, 0), new Point(EXTENT, EXTENT)]) as ReadOnlyBounds;