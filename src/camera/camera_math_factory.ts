import {MercatorCameraMath} from './mercator_camera_math.ts';
import {VerticalPerspectiveCameraMath} from './vertical_perspective_camera_math.ts';
import {GlobeCameraMath} from './globe_camera_math.ts';

import type {ProjectedCamera} from './projected_camera.ts';
import type {CameraMath} from './camera_math.ts';

/** The math of each projection holds nothing, so every camera of a projection shares one. */
const mercatorCameraMath = new MercatorCameraMath();
const verticalPerspectiveCameraMath = new VerticalPerspectiveCameraMath();
const globeCameraMath = new GlobeCameraMath(mercatorCameraMath, verticalPerspectiveCameraMath);

/** @internal The {@link CameraMath} of the projection a camera was projected in. */
export function getCameraMath(projectedCamera: ProjectedCamera): CameraMath {
    switch (projectedCamera.projection) {
        case 'mercator': return mercatorCameraMath;
        case 'vertical-perspective': return verticalPerspectiveCameraMath;
        case 'globe': return globeCameraMath;
    }
}
