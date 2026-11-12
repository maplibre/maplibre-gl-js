import {quat, vec3} from 'gl-matrix';
import {LngLat, earthRadius, type LngLatLike} from '../lng_lat.ts';
import {angleToRotateBetweenVectors2D, clamp, createVec3f64, createVec4f64, degreesToRadians, differenceOfAnglesDegrees, distanceOfAnglesRadians, MAX_VALID_LATITUDE, mod, radiansToDegrees, scaleZoom, warnOnce, wrap} from '../../util/util.ts';
import {angularCoordinatesToSurfaceVector, getGlobeRadiusPixels, getZoomAdjustment, lngLatBearingFromOrientation, orientationFromLngLatBearing, sphereSurfacePointToCoordinates} from './globe_utils.ts';
import {applyConstrain} from './camera_constrain.ts';
import {getConstrainedCamera, moveCenterToElevation, setBearing, setCenter, setCenterAndZoom, setZoom} from './camera_updates.ts';
import {projectCamera} from './project_camera.ts';
import {renderedProjectedCamera} from '../projected_camera.ts';
import {getCameraMath} from './camera_math_factory.ts';
import {unprojectScreenPoint} from './vertical_perspective_camera_math.ts';
import {getBearing} from '../camera_view_state.ts';

import type Point from '@mapbox/point-geometry';
import type {CameraViewState} from '../camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';
import type {CameraOptionsFromTo, WorldCoordinateHelper} from '../camera_types.ts';
import type {ProjectedCamera, VerticalPerspectiveProjectedCamera} from '../projected_camera.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {CameraSolver} from './camera_solver.ts';

/** Two points on the unit globe closer than this, a micrometre, are the same point. */
const SAME_POINT_DISTANCE = 1e-12;
/** A camera whose horizontal offset is this small relative to its distance is straight above the center. */
const STRAIGHT_ABOVE_RATIO = 1e-9;

/** The camera of a view in a context that renders with the vertical perspective, as the vertical perspective projects it. */
function projectVerticalPerspective(view: CameraViewState, context: CameraContext): VerticalPerspectiveProjectedCamera {
    return renderedProjectedCamera(projectCamera(view, context)) as VerticalPerspectiveProjectedCamera;
}

/**
 * @internal
 * The {@link CameraSolver} of a camera rendered with the vertical perspective, which solves on the planet's surface
 * and keeps the planet at the size it has.
 */
export class VerticalPerspectiveCameraSolver implements CameraSolver {
    setLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point): CameraViewState {
        const camera = this.getCameraForLocationAtPoint(view, context, lnglat, point);
        return camera ? setCenterAndZoom(view, camera.center, camera.zoom) : view;
    }

    /**
     * The elevation is ignored: the vertical perspective solves on the planet's surface. A screen point off the planet
     * gives the point on the horizon closest to it, see {@link unprojectScreenPoint}. The zoom
     * keeps the planet at the size it has now, from the latitude the constrain lets the center reach.
     */
    getCameraForLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point): {center: LngLat; zoom: number} | null {
        const rendered = projectVerticalPerspective(view, context);
        const pointLngLat = unprojectScreenPoint(rendered, point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3f64();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3f64();
        vec3.rotateY(rotatedPixelVector, vecToPixelCurrent, zero, -rendered.center.lng * Math.PI / 180.0);
        vec3.rotateX(rotatedPixelVector, rotatedPixelVector, zero, rendered.center.lat * Math.PI / 180.0);

        // We are looking for the lng,lat that will rotate `vecToTarget`
        // so that it is equal to `rotatedPixelVector`.

        // The second rotation around X axis cannot change the X component,
        // so we first must find the longitude such that rotating `vecToTarget` with it
        // will place it so its X component is equal to X component of `rotatedPixelVector`.
        // There will exist zero, one or two longitudes that satisfy this.

        //      x  |
        //     /   |
        //    /    | the line is the target X - rotatedPixelVector.x
        //   /     | the x is vecToTarget projected to x,z plane
        //  .      | the dot is origin
        //
        // We need to rotate vecToTarget so that it intersects the line.
        // If vecToTarget is shorter than the distance to the line from origin, it is impossible.

        // Otherwise, we compute the intersection of the line with a ring with radius equal to
        // length of vecToTarget projected to XZ plane.

        const vecToTargetXZLengthSquared = vecToTarget[0] * vecToTarget[0] + vecToTarget[2] * vecToTarget[2];
        const targetXSquared = rotatedPixelVector[0] * rotatedPixelVector[0];
        if (vecToTargetXZLengthSquared < targetXSquared) {
            // Zero solutions - setLocationAtPoint is impossible.
            return null;
        }

        // The intersection's Z coordinates
        const intersectionA = Math.sqrt(vecToTargetXZLengthSquared - targetXSquared);
        const intersectionB = -intersectionA; // the second solution

        const lngA = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionA);
        const lngB = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionB);

        const vecToTargetLngA = createVec3f64();
        vec3.rotateY(vecToTargetLngA, vecToTarget, zero, -lngA);
        const latA = angleToRotateBetweenVectors2D(vecToTargetLngA[1], vecToTargetLngA[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        const vecToTargetLngB = createVec3f64();
        vec3.rotateY(vecToTargetLngB, vecToTarget, zero, -lngB);
        const latB = angleToRotateBetweenVectors2D(vecToTargetLngB[1], vecToTargetLngB[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        // Is at least one of the needed latitudes valid?

        const limit = Math.PI * 0.5;

        const isValidA = latA >= -limit && latA <= limit;
        const isValidB = latB >= -limit && latB <= limit;

        let validLng: number;
        let validLat: number;
        if (isValidA && isValidB) {
            // Pick the solution that is closer to current map center.
            const centerLngRadians = rendered.center.lng * Math.PI / 180.0;
            const centerLatRadians = rendered.center.lat * Math.PI / 180.0;
            const lngDistA = distanceOfAnglesRadians(lngA, centerLngRadians);
            const latDistA = distanceOfAnglesRadians(latA, centerLatRadians);
            const lngDistB = distanceOfAnglesRadians(lngB, centerLngRadians);
            const latDistB = distanceOfAnglesRadians(latB, centerLatRadians);

            if ((lngDistA + latDistA) < (lngDistB + latDistB)) {
                validLng = lngA;
                validLat = latA;
            } else {
                validLng = lngB;
                validLat = latB;
            }
        } else if (isValidA) {
            validLng = lngA;
            validLat = latA;
        } else if (isValidB) {
            validLng = lngB;
            validLat = latB;
        } else {
            // No solution.
            return null;
        }

        const newLng = validLng / Math.PI * 180;
        const newLat = clamp(validLat / Math.PI * 180, -90, 90);
        const moved = newLng !== rendered.center.lng || newLat !== rendered.center.lat;
        const {center, zoom} = moved ?
            getConstrainedCamera(view, context, new LngLat(newLng, newLat), rendered.zoom) :
            {center: rendered.center, zoom: rendered.zoom};
        const adjustedZoom = applyConstrain(view, context, center, zoom + getZoomAdjustment(rendered.center.lat, center.lat)).zoom;
        if (adjustedZoom !== zoom) return getConstrainedCamera(view, context, center, adjustedZoom);
        return moved ? {center, zoom} : null;
    }

    /** Recenters onto sea level only, and leaves a camera over terrain where it is. */
    recenterOnTerrain(view: CameraViewState, context: CameraContext, terrain?: Terrain): CameraViewState {
        if (terrain) {
            warnOnce('terrain is not fully supported on vertical perspective projection.');
            return view;
        }
        return moveCenterToElevation(view, context, 0);
    }

    /**
     * Inverts the camera placement of the vertical perspective in unit-globe coordinates: the camera sits at radius
     * `1 + altitudeFrom / earthRadius` and looks at the center on the sea-level sphere, the target altitude only becoming
     * the center elevation. Pitch and bearing are read in the center's local frame, +z up, +y north, +x east. A camera
     * straight above the center keeps the camera's bearing.
     */
    calculateCameraOptionsFromTo(view: CameraViewState, context: CameraContext, from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const rendered = projectVerticalPerspective(view, context);
        const center = LngLat.convert(to);
        const camera = angularCoordinatesToSurfaceVector(LngLat.convert(from));
        vec3.scale(camera, camera, 1 + altitudeFrom / earthRadius);
        const target = angularCoordinatesToSurfaceVector(center);
        const targetAtAltitude = vec3.scale(createVec3f64(), target, 1 + altitudeTo / earthRadius);
        const toCamera = vec3.subtract(createVec3f64(), camera, target);
        const distance = vec3.length(toCamera);
        if (distance < SAME_POINT_DISTANCE || vec3.distance(camera, targetAtAltitude) < SAME_POINT_DISTANCE) {
            throw new Error('Can\'t calculate camera options with same From and To');
        }

        const zero = createVec3f64();
        vec3.rotateY(toCamera, toCamera, zero, -degreesToRadians(center.lng));
        vec3.rotateX(toCamera, toCamera, zero, degreesToRadians(center.lat));
        const pitch = radiansToDegrees(Math.acos(clamp(toCamera[2] / distance, -1, 1)));
        const straightAbove = Math.hypot(toCamera[0], toCamera[1]) < distance * STRAIGHT_ABOVE_RATIO;
        const bearing = straightAbove ? getBearing(rendered) : radiansToDegrees(Math.atan2(-toCamera[0], -toCamera[1]));

        // The camera sits cameraToCenterDistance / getGlobeRadiusPixels(worldSize, lat) from the center, and the radius doubles per zoom level.
        const zoom = scaleZoom(rendered.cameraToCenterDistance / distance / getGlobeRadiusPixels(rendered.tileSize, center.lat));

        return {center, elevation: altitudeTo, zoom, pitch, bearing};
    }
}

/**
 * How much of the angle between the view axis and the horizon is given over to easing off, measured
 * inward from the horizon. Only the outermost sliver of the globe is affected, where a pixel is
 * already worth degrees of arc.
 *
 * This is the one number here open to taste, and it sets two things at once: narrowing it keeps the
 * drag exact over more of the globe, and, since the exact curve steepens towards tangency, hands
 * over at a higher rate too. Bell has no such freedom, as a hyperbola of the fixed form `k/d` meets
 * a sphere in both value and slope at exactly one radius.
 */
const PAN_FALLOFF_BAND = 0.1;

/**
 * Radius around the pole's screen position, in pixels, within which the cursor's sweep around it
 * stops being trusted at face value: the angle a given drag subtends grows without bound as the
 * cursor closes on the pole, and at the pole itself there is no angle at all.
 */
const DIAL_MIN_RADIUS_PIXELS = 20;

/** Kept just below a half turn so the center cannot land exactly on the far side of the globe. */
const PAN_MAX_ANGLE = Math.PI * 0.98;

/**
 * Returns the point on the globe that a drag towards `point` should aim at.
 *
 * Exact tracking breaks down at the silhouette: the ray meets the globe at `asin(D sin a) - a`,
 * whose slope runs away to infinity as the ray goes tangent, and past it there is no intersection
 * at all. So the exact curve is left {@link PAN_FALLOFF_BAND} early and continued with a hyperbola
 * matching it in value and slope, easing off and saturating short of the far side. Bell's virtual
 * trackball takes the same idea of easing a sphere into a hyperbola before the rim, though it fits
 * the curve differently: SGI's `trackball.c`, described in Henriksen, Sporring and Hornbæk,
 * "Virtual Trackballs Revisited", IEEE TVCG 10(2):206-216, 2004.
 *
 * The angle comes from atan2, so a ray pointing away from the globe is a wide angle the falloff
 * saturates rather than a case to reject.
 * @param data - The camera being dragged.
 * @param point - The cursor position.
 */
function panSurfaceLocation(rendered: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, point: Point): LngLat {
    const origin = rendered.cameraPosition;
    const distance = vec3.length(origin);
    if (distance <= 1) {
        return getCameraMath(rendered).screenPointToLocation(rendered, worldCoordinateHelper, point);
    }

    const u = createVec3f64();
    vec3.normalize(u, origin);
    const direction = getCameraMath(rendered).getRayDirectionFromPixel(rendered, point);
    const c = -vec3.dot(direction, u);
    const lateral = createVec3f64();
    vec3.scaleAndAdd(lateral, direction, u, c);
    const s = vec3.length(lateral);
    if (s < 1e-9) {
        return getCameraMath(rendered).screenPointToLocation(rendered, worldCoordinateHelper, point);
    }

    const angle = Math.atan2(s, c);
    const horizonAngle = Math.asin(1 / distance);
    const handoverAngle = horizonAngle * (1 - PAN_FALLOFF_BAND);
    if (angle < handoverAngle) {
        return getCameraMath(rendered).screenPointToLocation(rendered, worldCoordinateHelper, point);
    }

    const sinHandover = distance * Math.sin(handoverAngle);
    const targetAtHandover = Math.asin(clamp(sinHandover, -1, 1)) - handoverAngle;
    const slopeAtHandover = distance * Math.cos(handoverAngle) / Math.sqrt(Math.max(1 - sinHandover * sinHandover, 1e-12)) - 1;
    const room = PAN_MAX_ANGLE - targetAtHandover;
    const excess = angle - handoverAngle;
    const target = targetAtHandover + room * (slopeAtHandover * excess) / (room + slopeAtHandover * excess);

    const e = createVec3f64();
    vec3.scale(e, lateral, 1 / s);
    const surface = createVec3f64();
    vec3.scale(surface, u, Math.cos(clamp(target, 0, PAN_MAX_ANGLE)));
    vec3.scaleAndAdd(surface, surface, e, Math.sin(clamp(target, 0, PAN_MAX_ANGLE)));
    vec3.normalize(surface, surface);
    return sphereSurfacePointToCoordinates(surface);
}

/**
 * Rotates the globe so that the given location appears at the given screen point, by composing
 * versors, the unit quaternions that represent rotations. Unlike the bearing-preserving
 * {@link VerticalPerspectiveCameraSolver.setLocationAtPoint}, this stays smooth near and across the poles, and keeps
 * panning once the cursor leaves the globe.
 *
 * Note: the delta rotation's axis is in the surface-vector frame of
 * {@link angularCoordinatesToSurfaceVector}, while the orientation quaternion uses the Euler frame
 * of {@link orientationFromLngLatBearing}, hence the component swizzle where they combine. Zoom is
 * adjusted to keep the planet the same size, as `setLocationAtPoint` does.
 * @param view - The camera to rotate.
 * @param context - The projection and the constrain the camera is moved with.
 * @param lnglat - The location to bring under `point`.
 * @param point - The screen point that `lnglat` should appear at.
 * @param panDelta - The drag's pixel delta. Used to re-derive the previous cursor location through
 * {@link panSurfaceLocation}, since both ends of the rotation must come from the same mapping.
 * @param fixedBearing - Applies the swing only, keeping the bearing fixed, which is what dragging
 * the globe does. Pass `false` to apply the twist about the view axis as well, so that the grabbed
 * location tracks the cursor exactly and the bearing drifts with it.
 */
export function versorSetLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point, panDelta?: Point, fixedBearing = true): CameraViewState {
    const rendered = projectCamera(view, context);
    const pointLngLat = panSurfaceLocation(rendered, context.worldCoordinateHelper, point);
    let sourceLngLat = lnglat;
    if (panDelta) {
        sourceLngLat = panSurfaceLocation(rendered, context.worldCoordinateHelper, point.sub(panDelta));
    } else if (!getCameraMath(rendered).isPointOnMapSurface(rendered, context.worldCoordinateHelper, point)) {
        return view;
    }

    const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
    const vecToTarget = angularCoordinatesToSurfaceVector(sourceLngLat);
    const centerQuat = orientationFromLngLatBearing(rendered.center, rendered.bearing);
    const w = vec3.cross(createVec3f64(), vecToTarget, vecToPixelCurrent);
    const l = Math.sqrt(vec3.dot(w, w));
    const t = Math.acos(clamp(vec3.dot(vecToTarget, vecToPixelCurrent), -1, 1)) / 2;
    const s = Math.sin(t);
    const delta = l ? quat.set(createVec4f64(), (w[1] / l) * s, (-w[0] / l) * s, (w[2] / l) * s, Math.cos(t)) : quat.identity(createVec4f64());
    const newCenterQuat = quat.multiply(createVec4f64(), centerQuat, delta);
    const {lng: newCenterLng, lat: newCenterLat, bearing: newBearing} = lngLatBearingFromOrientation(newCenterQuat);

    const finalLat = fixedBearing ? fixedBearingLatitude(rendered.bearing, newCenterLat, newBearing) : newCenterLat;
    const finalLng = fixedBearing ? fixedBearingLongitude(rendered, context.worldCoordinateHelper, point, panDelta, newCenterLng) : newCenterLng;

    let moved = setCenter(view, context, new LngLat(wrap(finalLng, -180, 180), finalLat));
    if (!fixedBearing) moved = setBearing(moved, newBearing);
    return setZoom(moved, context, view.zoom + getZoomAdjustment(view.center.lat, moved.center.lat));
}

/**
 * Returns the center latitude for a bearing-preserving drag. A swing over a pole turns the bearing around,
 * so with the bearing held the center stops on that pole.
 */
function fixedBearingLatitude(bearing: number, newCenterLat: number, newBearing: number): number {
    if (Math.abs(differenceOfAnglesDegrees(bearing, newBearing)) <= 90) {
        return newCenterLat;
    }
    return newCenterLat > 0 ? 90 : -90;
}

/**
 * Returns the center longitude for a bearing-preserving drag.
 *
 * The swing longitude becomes ill-conditioned near the pole and the grabbed location slips away
 * from the cursor, so within the last ~12 degrees of latitude the cursor is treated as turning a
 * dial around the pole, blended in with a smoothstep anchored on {@link MAX_VALID_LATITUDE} and in
 * full from there to the pole. The sweep comes from the raw pixel delta rather than a
 * round-tripped previous cursor position, which would lose its sign to cancellation at the pole,
 * and is damped within {@link DIAL_MIN_RADIUS_PIXELS} so it eases to nothing there instead of
 * being dropped, which would leave a spot where the drag could not move at all.
 * @param data - The camera being dragged.
 * @param point - The cursor position.
 * @param panDelta - The drag's pixel delta, or undefined to use the swing longitude only.
 * @param newCenterLng - The swing target longitude.
 * @returns the center longitude to apply.
 */
function fixedBearingLongitude(rendered: ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, point: Point, panDelta: Point | undefined, newCenterLng: number): number {
    const oldLng = rendered.center.lng;
    const oldLat = rendered.center.lat;
    const poleLat = oldLat >= 0 ? 90 : -90;
    const polePoint = getCameraMath(rendered).locationToScreenPoint(rendered, worldCoordinateHelper, new LngLat(0, poleLat));
    const rx = point.x - polePoint.x, ry = point.y - polePoint.y;
    const r2 = rx * rx + ry * ry;

    const tRamp = clamp(1 - (MAX_VALID_LATITUDE - Math.abs(oldLat)) / 12, 0, 1);
    const dial = tRamp * tRamp * (3 - 2 * tRamp);
    const dLngSwing = mod(newCenterLng - oldLng + 180, 360) - 180;

    let dLngDial = 0;
    if (dial > 0 && panDelta) {
        const dTheta = (rx * panDelta.y - ry * panDelta.x) / Math.max(r2, DIAL_MIN_RADIUS_PIXELS * DIAL_MIN_RADIUS_PIXELS);
        dLngDial = (poleLat > 0 ? 1 : -1) * dTheta * 180 / Math.PI;
    }

    return oldLng + (1 - dial) * dLngSwing + dial * dLngDial;
}
