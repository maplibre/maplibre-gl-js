import type {LngLat} from '../geo/lng_lat.ts';
import type {ITransform} from '../geo/transform_interface.ts';

/**
 * A camera movement: where the camera is at each point along the way, and what it passes through to
 * get there.
 *
 * The animation runs one of these on the map's transform. The tile preload runs the *same* one on a
 * throwaway transform, to learn which tiles the movement will cover before it gets there. Both read
 * this one description, which is what makes the tiles a movement is promised the tiles it asks for,
 * and the reason the preload keeps no copy of the path of its own.
 */
export type CameraMovement = {
    /**
     * The camera state the movement starts from, and the one it edits as it runs.
     */
    transform: ITransform;

    /**
     * How long the movement takes, in milliseconds, or `0` for a movement that does not animate.
     */
    duration: number;

    /**
     * The movement's easing. Both the animation and the preload read progress through it, so that a
     * sample is the camera state the camera is in when it reports having come that far.
     */
    easing: (k: number) => number;

    /**
     * Whether the movement holds the center elevation instead of easing it over the terrain.
     */
    freezeElevation: boolean;

    /**
     * The center the movement ends on, which the elevation it passes through is measured against.
     */
    elevationCenter: LngLat;

    /**
     * Returns a function that puts `tr` in the camera state this movement reaches at progress `k`.
     *
     * A camera handler binds to the transform it was built from, and remembers where that transform
     * started, so each transform needs its own: the animation asks for the movement's own, and the
     * preload asks for its throwaway copy. Both are built from the same starting state, so both walk
     * the same path. Ask once per transform and reuse what comes back.
     *
     * @param tr - the camera state to advance
     */
    at: (tr: ITransform) => (k: number) => void;

    /**
     * Puts `tr` at the center elevation, and at the lowest tile elevation under
     * {@link CameraMovement.elevationCenter}, that this movement has reached at progress `k`.
     *
     * A camera's elevation decides which tiles cover it, so a preload has to apply it as well as the
     * animation does: without this, a preload over terrain would ask for the tiles of a camera flying
     * at sea level. Does nothing when there is no terrain.
     *
     * @param tr - the camera state to apply the elevation to
     * @param k - the movement's progress, 0 to 1
     */
    applyElevation: (tr: ITransform, k: number) => void;
};
