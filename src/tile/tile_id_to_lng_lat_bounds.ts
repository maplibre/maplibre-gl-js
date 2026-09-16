import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {worldBoxToLngLatBox} from '../geo/projection/mercator_utils.ts';

import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';
import type {CanonicalTileID} from './tile_id.ts';

/**
 * The lng/lat box of a tile, grown by `buffer` tile units (0 for the bare tile), in the given world mapping.
 * The four tile corners are mapped back and their hull is returned, so the box is exact for mercator
 * and a conservative cover for a mapping where both axes depend on lng and lat.
 */
export function tileIdToLngLatBounds(
    {x,y,z}: CanonicalTileID,
    buffer: number,
    worldCoordinateHelper: WorldCoordinateHelper,
): LngLatBounds {
    const worldSize = Math.pow(2, z);
    const {west, south, east, north} = worldBoxToLngLatBox(
        worldCoordinateHelper,
        (x - buffer) / worldSize,
        (y - buffer) / worldSize,
        (x + 1 + buffer) / worldSize,
        (y + 1 + buffer) / worldSize);

    return new LngLatBounds([west, south], [east, north]);
}
