import {createCameraMetrics} from './projected_camera.ts';
import {createMercatorProjectedCamera} from './mercator_camera_math.ts';
import {createVerticalPerspectiveProjectedCamera} from './vertical_perspective_camera_math.ts';

import type {CameraMetrics, ProjectedCamera} from './projected_camera.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/** The {@link CameraMetrics} derived from each {@link CameraViewState}, for each world mapping it was derived in. */
const metricsCache = new WeakMap<CameraViewState, WeakMap<WorldCoordinateHelper, CameraMetrics>>();

/**
 * The {@link ProjectedCamera} derived from each {@link CameraViewState}, by the world mapping and then the projection
 * it was derived in, see {@link projectionKey}.
 */
const projectedCameraCache = new WeakMap<CameraViewState, WeakMap<WorldCoordinateHelper, Map<string, ProjectedCamera>>>();

/** The projection a camera is projected in, as a key: a globe's transition changes it, other projections ignore it. */
function projectionKey({projection, projectionTransition}: CameraContext): string {
    return projection === 'globe' ? `globe:${projectionTransition}` : projection;
}

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

/**
 * @internal
 * The {@link ProjectedCamera} of a camera view state in a projection: what the camera is drawn and queried with. It is derived
 * once per state and projection, both of which are never written to, and kept for as long as the state.
 */
export function projectCamera(view: CameraViewState, context: CameraContext): ProjectedCamera {
    let byHelper = projectedCameraCache.get(view);
    if (!byHelper) projectedCameraCache.set(view, byHelper = new WeakMap());
    let byProjection = byHelper.get(context.worldCoordinateHelper);
    if (!byProjection) byHelper.set(context.worldCoordinateHelper, byProjection = new Map());
    const key = projectionKey(context);
    let projectedCamera = byProjection.get(key);
    if (!projectedCamera) byProjection.set(key, projectedCamera = createProjectedCamera(view, context));
    return projectedCamera;
}

/** Creates the {@link ProjectedCamera} of a camera view state in a context, see {@link projectCamera}. */
function createProjectedCamera(view: CameraViewState, context: CameraContext): ProjectedCamera {
    const {worldCoordinateHelper} = context;
    const metrics = getCameraMetrics(view, worldCoordinateHelper);
    if (context.projection === 'mercator') return createMercatorProjectedCamera(metrics, worldCoordinateHelper);
    if (context.projection === 'vertical-perspective') return createVerticalPerspectiveProjectedCamera(metrics);
    // While the globe renders, mercator draws at the vertical perspective's depths, which keeps the two render paths
    // at the same depth across the transition.
    const globeness = context.projectionTransition;
    const verticalPerspective = createVerticalPerspectiveProjectedCamera(metrics);
    const globeRendering = globeness > 0;
    const nearFarZ = globeRendering && view.width && view.height ? {nearZ: verticalPerspective.nearZ, farZ: verticalPerspective.farZ} : view.nearFarZOverride;
    const mercator = createMercatorProjectedCamera(metrics, worldCoordinateHelper, nearFarZ);
    const rendered = globeRendering ? verticalPerspective : mercator;
    return {
        ...metrics,
        projection: 'globe',
        globeness,
        mercator,
        verticalPerspective,
        nearZ: rendered.nearZ,
        farZ: rendered.farZ,
        projectionMatrix: rendered.projectionMatrix,
        modelViewProjectionMatrix: rendered.modelViewProjectionMatrix,
        inverseProjectionMatrix: rendered.inverseProjectionMatrix,
        cameraPosition: rendered.cameraPosition,
        clippingPlane: rendered.clippingPlane,
    };
}
