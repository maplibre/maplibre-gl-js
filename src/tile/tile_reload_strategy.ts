import type {LngLatBounds} from '../geo/lng_lat_bounds';

/**
 * @internal
 * Strategies for determining whether tiles should be reloaded based on the specific source type.
 */
export type TileReloadStrategy =
    | GeoJSONReloadStrategy
    // Add more source types here as needed
    ;

/**
 * @internal
 * Reload strategy for GeoJSON sources.
 * Reloads tiles that intersect or are affected by changed features.
 */
export type GeoJSONReloadStrategy = {
    type: 'geojson';
    /**
     * Bounds of features that were added or updated (will be in these tiles)
     */
    nextBounds: LngLatBounds[];
    /**
     * IDs of features that were updated or removed (were in these tiles)
     */
    prevIds: Set<GeoJSON.Feature['id']>;
};