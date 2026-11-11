import {LngLat} from '../geo/lng_lat.ts';
import * as cameraMath from '../geo/projection/camera_math.ts';

import type Point from '@mapbox/point-geometry';
import type {ProjectedCamera} from '../geo/projected_camera.ts';
import type {CameraProjection} from '../geo/projection/camera_projection.ts';

/**
 * Given a LngLat, prior projected position, and a camera and its projection, return a new LngLat shifted
 * n × 360° east or west for some n ≥ 0 such that:
 *
 * * the projected location of the result is on screen, if possible, and secondarily:
 * * the difference between the projected location of the result and the prior position
 *   is minimized.
 *
 * The object is to preserve perceived object constancy for Popups and Markers as much as
 * possible; they should avoid shifting large distances across the screen, even when the
 * map center changes by ±360° due to automatic wrapping, and when about to go off screen,
 * should wrap just enough to avoid doing so.
 */
export function smartWrap(lngLat: LngLat, priorPos: Point, camera: ProjectedCamera, projection: CameraProjection, useNormalWrap: boolean = false): LngLat {
    if (useNormalWrap || !cameraMath.getCoveringTilesDetailsProvider(projection).allowWorldCopies()) {
        return lngLat?.wrap();
    }
    const originalLngLat = new LngLat(lngLat.lng, lngLat.lat);
    lngLat = new LngLat(lngLat.lng, lngLat.lat);

    // First, try shifting one world in either direction, and see if either is closer to the
    // prior position. This preserves object constancy when the map center is auto-wrapped
    // during animations.
    if (priorPos) {
        const left  = new LngLat(lngLat.lng - 360, lngLat.lat);
        const right = new LngLat(lngLat.lng + 360, lngLat.lat);
        const delta = cameraMath.locationToScreenPoint(camera, projection, lngLat).distSqr(priorPos);
        if (cameraMath.locationToScreenPoint(camera, projection, left).distSqr(priorPos) < delta) {
            lngLat = left;
        } else if (cameraMath.locationToScreenPoint(camera, projection, right).distSqr(priorPos) < delta) {
            lngLat = right;
        }
    }

    // Second, wrap toward the center until the new position is on screen, or we can't get
    // any closer.
    while (Math.abs(lngLat.lng - camera.center.lng) > 180) {
        const pos = cameraMath.locationToScreenPoint(camera, projection, lngLat);
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= camera.width && pos.y <= camera.height) {
            break;
        }
        if (lngLat.lng > camera.center.lng) {
            lngLat.lng -= 360;
        } else {
            lngLat.lng += 360;
        }
    }

    // Apply the change only if new coord is below horizon
    if (lngLat.lng !== originalLngLat.lng && cameraMath.isPointOnMapSurface(camera, projection, cameraMath.locationToScreenPoint(camera, projection, lngLat))) {
        return lngLat;
    }

    return originalLngLat;
}
