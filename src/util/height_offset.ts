import type {LngLat} from '../geo/lng_lat.ts';
import type {Map} from '../ui/map.ts';

export type HeightAnchor = 'ground' | 'absolute';

/**
 * @internal
 * The elevation, in meters above the zero elevation datum, at which a marker or popup with the given height
 * offset is drawn, or `undefined` when it sits on the ground and the ordinary ground projection applies.
 * `absolute` ignores the terrain below the location, `ground` adds the offset to it.
 */
export function getElevationForHeightOffset(map: Map, lngLat: LngLat, heightOffset: number, heightAnchor: HeightAnchor): number | undefined {
    if (heightAnchor === 'absolute') return heightOffset;
    if (!heightOffset) return undefined;
    const terrain = map.terrain;
    return heightOffset + (terrain ? terrain.getElevationForLngLat(lngLat, map._camera.transform) : 0);
}
