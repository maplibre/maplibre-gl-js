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
 * The location under a screen point on the camera the handlers asked for, see {@link Camera.proposedTransform}, or
 * undefined where the point shows the sky or the space around the globe rather than the map.
 */
export function locationOnMapAt(camera: Camera, point: Point): LngLat | undefined {
    const transform = camera.proposedTransform;
    if (!transform.isPointOnMapSurface(point)) return undefined;
    return transform.screenPointToLocation(point, camera.terrain);
}
