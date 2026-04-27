import {EXTENT} from '../extent';

import type {CanonicalTileID} from '../../tile/tile_id';

/**
 * Returns a predicate that tests whether an edge lies on the antimeridian
 * tile boundary (x=0 on the left-most tile, or x=EXTENT on the right-most tile).
 * Returns null when the given tile is not on either antimeridian border, so
 * callers can short-circuit the work entirely.
 *
 * When geojson-vt clips polygons at the antimeridian, it creates artificial
 * edges along the clip boundary that would otherwise be drawn as visible
 * strokes. Buckets use this predicate to skip those edges.
 */
export function getAntimeridianEdgePredicate(
    canonical: CanonicalTileID | undefined,
): ((x0: number, x1: number) => boolean) | null {
    if (!canonical) return null;
    const suppressLeft = canonical.x === 0;
    const suppressRight = canonical.x === (1 << canonical.z) - 1;
    if (!suppressLeft && !suppressRight) return null;
    return (x0, x1) =>
        (suppressLeft && x0 === 0 && x1 === 0) ||
        (suppressRight && x0 === EXTENT && x1 === EXTENT);
}
