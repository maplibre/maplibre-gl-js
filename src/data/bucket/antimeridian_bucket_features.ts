import {EXTENT} from '../extent';

import type {CanonicalTileID} from '../../tile/tile_id';

/**
 * Returns an `isAntimeridianEdge(x0, x1)` test for the given tile, or `null`
 * when the tile is not on the antimeridian (left-most or right-most column),
 * so callers can short-circuit.
 *
 * When geojson-vt clips polygons at the antimeridian it creates artificial
 * edges along the clip boundary; buckets use this test to skip drawing them.
 */
export function createIsAntimeridianEdge(
    canonical: CanonicalTileID,
): ((x0: number, x1: number) => boolean) | null {
    const suppressLeft = canonical.x === 0;
    const suppressRight = canonical.x === (1 << canonical.z) - 1;
    if (!suppressLeft && !suppressRight) return null;
    return (x0, x1) =>
        (suppressLeft && x0 === 0 && x1 === 0) ||
        (suppressRight && x0 === EXTENT && x1 === EXTENT);
}
