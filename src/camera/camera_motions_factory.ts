import {usesGlobeControls} from './camera_context.ts';
import {MercatorCameraMotions} from './mercator_camera_motions.ts';
import {VerticalPerspectiveCameraMotions} from './vertical_perspective_camera_motions.ts';

import type {CameraContext} from './camera_context.ts';
import type {CameraMotions} from './camera_motions.ts';

/** The motions of each projection hold nothing, so every camera drawn with a projection shares them. */
const mercatorCameraMotions = new MercatorCameraMotions();
const verticalPerspectiveCameraMotions = new VerticalPerspectiveCameraMotions(mercatorCameraMotions);

/** @internal The {@link CameraMotions} of the projection a camera in a context is drawn with, see {@link usesGlobeControls}. */
export function getCameraMotions(context: CameraContext): CameraMotions {
    return usesGlobeControls(context) ? verticalPerspectiveCameraMotions : mercatorCameraMotions;
}
