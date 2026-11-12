import {createCameraMetrics} from './projected_camera.ts';

import type {CameraMetrics} from './projected_camera.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/** The {@link CameraMetrics} derived from each {@link CameraViewState}, for each world mapping it was derived in. */
const metricsCache = new WeakMap<CameraViewState, WeakMap<WorldCoordinateHelper, CameraMetrics>>();

/**
 * @internal
 * The values every projection derives from a camera view state, see {@link createCameraMetrics}, kept for as long as the
 * state, which is never written to.
 */
export function getCameraMetrics(view: CameraViewState, worldCoordinateHelper: WorldCoordinateHelper): CameraMetrics {
    let byHelper = metricsCache.get(view);
    if (!byHelper) metricsCache.set(view, byHelper = new WeakMap());
    let camera = byHelper.get(worldCoordinateHelper);
    if (!camera) byHelper.set(worldCoordinateHelper, camera = createCameraMetrics(view, worldCoordinateHelper));
    return camera;
}
