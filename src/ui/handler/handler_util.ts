import {getCameraMath} from '../../camera/camera_math_factory.ts';

import type Point from '@mapbox/point-geometry';
import type {Camera} from '../camera.ts';
import type {LngLat} from '../../geo/lng_lat.ts';

export function indexTouches(touches: Touch[], points: Point[]): Record<number, Point> {
    if (touches.length !== points.length) throw new Error(`The number of touches and points are not equal - touches ${touches.length}, points ${points.length}`);
    const obj: Record<number, Point> = {};
    for (let i = 0; i < touches.length; i++) {
        obj[touches[i].identifier] = points[i];
    }
    return obj;
}

/**
 * The location under a screen point on the camera the handlers asked for, see {@link Camera.proposedProjectedCamera},
 * or undefined where the point shows the sky or the space around the globe rather than the map.
 */
export function locationOnMapAt(camera: Camera, point: Point): LngLat | undefined {
    const projectedCamera = camera.proposedProjectedCamera;
    const cameraMath = getCameraMath(projectedCamera);
    const {worldCoordinateHelper} = camera.context;
    if (!cameraMath.isPointOnMapSurface(projectedCamera, worldCoordinateHelper, point)) return undefined;
    return cameraMath.screenPointToLocation(projectedCamera, worldCoordinateHelper, point, camera.terrain);
}
