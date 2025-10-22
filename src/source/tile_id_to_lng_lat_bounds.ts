import {latFromMercatorY, lngFromMercatorX} from '../geo/mercator_coordinate';
import {LngLatBounds} from '../geo/lng_lat_bounds';
import type {CanonicalTileID} from './tile_id';

export function tileIdToLngLatBounds(
    {x,y,z}: CanonicalTileID,
    buffer: number = 0,
): LngLatBounds {
    const lngMin = lngFromMercatorX((x - buffer) / Math.pow(2, z));
    const latMin = latFromMercatorY((y + 1 + buffer) / Math.pow(2, z));

    const lngMax = lngFromMercatorX((x + 1 + buffer) / Math.pow(2, z));
    const latMax = latFromMercatorY((y - buffer) / Math.pow(2, z));

    return new LngLatBounds([lngMin, latMin], [lngMax, latMax]);
}
