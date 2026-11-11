import type {LngLat} from '../geo/lng_lat.ts';
import type {Terrain} from '../render/terrain.ts';

/** Who holds the center elevation: a gesture, or an animation with `freezeElevation`. */
export type ElevationHolder = 'gesture' | 'animation';

/**
 * Where a hold stands with the DEM data under the center:
 * - `loaded`: the tile under the center had its DEM data when the hold started, so the hold keeps its elevation.
 * - `awaiting`: no DEM data under the center yet, from the start or since a terrain change left none there; the
 * hold follows the terrain drawn there, see {@link takeDrawnElevation}.
 * - `taken`: the hold waited and then took the elevation of the tile's own DEM data. Unlike `loaded`, the elevation
 * came during the hold, so the end keeps the zoom where that data is missing again, see
 * {@link Camera.putCenterBackOnTerrain}.
 */
export type DEMHoldState = 'loaded' | 'awaiting' | 'taken';

/**
 * A movement's hold on the center elevation: the frames of a gesture or of an animation with `freezeElevation` leave
 * the requested elevation where it is, so the camera does not bob over the terrain, and the end puts the center back
 * onto the terrain, see {@link Camera.releaseElevation}.
 */
export type HeldCenterElevation = {
    rule: 'held';
    holder: ElevationHolder;
    dem: DEMHoldState;
    /**
     * Whether the camera is lifted far enough that the drawn terrain stays below where the center would sit at maxZoom,
     * see {@link Camera._terrainHeightAboveMaxZoomForCenter}: from the start of a hold that starts with the terrain
     * below that point, as on the ground at rest, or from the first frame the terrain is below it. A hold that starts
     * with the terrain above it, as behind a crest, leaves the terrain there.
     */
    keepsTerrainBelowMaxZoomForCenter: boolean;
};

/**
 * How the requested center elevation follows the terrain while the center is clamped to the ground:
 * - `ground`: the center sits on the terrain, keeping the elevation it has while the DEM data under it loads.
 * - `held`: a movement holds it, see {@link HeldCenterElevation}.
 * - `eased`: an animation eases it to the terrain under the center it ends on.
 *
 * Without terrain the center is drawn at sea level whatever the rule, and the requested elevation is left for the
 * terrain to come back to.
 */
export type CenterElevationRule = {rule: 'ground'} | {rule: 'eased'} | HeldCenterElevation;

/**
 * What a hold that waits for DEM data under the center takes from the terrain drawn there: a loaded parent tile's DEM
 * data, drawn in place of the tile's own until that lands, and then the tile's own, which ends the wait.
 * @returns the hold and the elevation it takes, or null where it takes nothing
 */
export function takeDrawnElevation(hold: HeldCenterElevation, center: LngLat, terrain: Terrain): {hold: HeldCenterElevation; elevation: number} | null {
    if (hold.dem !== 'awaiting') return null;
    const ownElevation = terrain.getDrawnElevationForLngLat(center, true);
    if (ownElevation !== undefined) return {hold: {...hold, dem: 'taken'}, elevation: ownElevation};
    const drawnElevation = terrain.getDrawnElevationForLngLat(center);
    return drawnElevation === undefined ? null : {hold, elevation: drawnElevation};
}
