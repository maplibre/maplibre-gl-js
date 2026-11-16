import type Point from '@mapbox/point-geometry';
import type {LngLat, LngLatLike} from '../geo/lng_lat.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';
import type {CameraOptionsFromTo} from './camera_types.ts';
import type {Terrain} from '../render/terrain.ts';

/**
 * @internal
 * The camera placements solved for from what the camera should show, which each projection the camera renders with
 * solves its own way. `getCameraSolver` in `camera_solver_factory.ts` picks the one for a context. The implementations
 * hold nothing, so every method is handed the camera view state and the context it is in.
 */
export interface CameraSolver {
    /**
     * The camera moved so that `lnglat`, on the ground at `elevation` meters, renders at the screen `point`, see
     * {@link CameraSolver.getCameraForLocationAtPoint}; the same camera where it stays where it is.
     */
    setLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point, elevation?: number): CameraViewState;

    /** The center and zoom that {@link CameraSolver.setLocationAtPoint} moves the camera to, or null where it stays. */
    getCameraForLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point, elevation?: number): {center: LngLat; zoom: number} | null;

    /** Moves the center onto the ground the camera looks at, with the camera where it is, and sets the zoom to match. */
    recenterOnTerrain(view: CameraViewState, context: CameraContext, terrain?: Terrain): CameraViewState;

    /**
     * The camera options that put the camera at `from`, `altitudeFrom` meters above sea level, looking at `to`, which
     * becomes the center at `altitudeTo` meters.
     */
    calculateCameraOptionsFromTo(view: CameraViewState, context: CameraContext, from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo;
}
