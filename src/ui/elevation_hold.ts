import type {Terrain} from '../render/terrain.ts';
import type {ITransform} from '../geo/transform_interface.ts';

/** Who holds the center elevation: a gesture, or an animation with `freezeElevation`. */
export type ElevationHolder = 'gesture' | 'animation';

/**
 * A hold on the center elevation, see {@link Camera.holdElevation}: one that started where no DEM data under a center
 * clamped to the ground had loaded, or whose terrain changed to one without DEM data there, waits for it and follows
 * the terrain drawn under the center until the tile there has its own. It holds no transform: a gesture's takes on the
 * terrain change, on the requested camera state its frames read; an animation's on its next frame, on the transform it
 * edits, which a projection change does not replace, or at its end when nothing ran in between.
 */
export class ElevationHold {
    /**
     * Where the hold stands with the DEM data under the center:
     * - `loaded`: the tile under the center had its DEM data when the hold started, so the hold keeps its elevation.
     * - `awaiting`: no DEM data under the center yet, from the start or since a terrain change left none there; the
     * hold follows the terrain drawn there, see {@link take}.
     * - `taken`: the hold waited and then took the elevation of the tile's own DEM data. Unlike `loaded`, the elevation
     * came during the hold, so the end keeps the zoom where that data is missing again, see
     * {@link Camera.putCenterBackOnTerrain}.
     */
    private _dem: 'loaded' | 'awaiting' | 'taken';
    /**
     * While {@link Camera._keepCameraAboveTerrain} has lifted the held elevation: the elevation held and how far above
     * it the camera was lifted, so later frames can lower it again as the terrain allows and tell the lifted elevation
     * from one a take set anew, which carries no lift; null while nothing is lifted.
     */
    lift: {heldElevation: number; height: number} | null = null;
    /**
     * Whether {@link Camera._keepCameraAboveTerrain} keeps the drawn terrain below where the center would sit at maxZoom,
     * see {@link Camera._terrainHeightAboveMaxZoomForCenter}: from the start of a hold that starts with the terrain below
     * that point, as on the ground at rest, or from the first frame the terrain is below it. A hold that starts with the
     * terrain above it, as behind a crest, leaves the terrain there.
     */
    keepsTerrainBelowMaxZoomForCenter: boolean;
    private _terrainChanged = false;

    /**
     * @param holder - who holds the elevation
     * @param startedWithoutDem - whether the hold started without DEM data under the center, and so waits for it
     * @param terrainBelowMaxZoomForCenter - whether the drawn terrain is below where the center would sit at maxZoom when
     * the hold starts, see {@link Camera._terrainHeightAboveMaxZoomForCenter}
     */
    constructor(readonly holder: ElevationHolder, startedWithoutDem: boolean, terrainBelowMaxZoomForCenter: boolean) {
        this._dem = startedWithoutDem ? 'awaiting' : 'loaded';
        this.keepsTerrainBelowMaxZoomForCenter = terrainBelowMaxZoomForCenter;
    }

    /** Whether the hold waited for DEM data under the center and took the data of the tile there. */
    get tookDem(): boolean {
        return this._dem === 'taken';
    }

    /** Asks the next {@link take} to check for DEM data under the center, after the terrain changed. */
    noteTerrainChange(): void {
        this._terrainChanged = true;
    }

    /**
     * While the hold waits, takes the elevation the terrain draws under the center: a loaded parent tile's DEM data,
     * drawn in place of the tile's own until that lands, and then the tile's own, which ends the wait. After a terrain
     * change that leaves no DEM data under the center, puts the center back at the 0 the terrain gives there and
     * waits again.
     * @param tr - the transform the gesture or animation edits
     * @param terrain - the terrain under it
     * @returns whether it changed the elevation
     */
    take(tr: ITransform, terrain: Terrain): boolean {
        let changed = false;
        if (this._terrainChanged) {
            this._terrainChanged = false;
            if (!terrain.hasElevationForLngLat(tr.center, tr)) {
                tr.setElevation(0);
                this._dem = 'awaiting';
                changed = true;
            }
        }
        if (this._dem !== 'awaiting') return changed;
        const elevation = terrain.getDrawnElevationForLngLat(tr.center, true);
        if (elevation !== undefined) {
            tr.setElevation(elevation);
            this._dem = 'taken';
            return true;
        }
        const drawnElevation = terrain.getDrawnElevationForLngLat(tr.center);
        if (drawnElevation === undefined || drawnElevation === tr.elevation) return changed;
        tr.setElevation(drawnElevation);
        return true;
    }
}
