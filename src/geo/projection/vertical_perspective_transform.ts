import {vec3} from 'gl-matrix';
import {Transform} from '../transform.ts';
import {LngLat, type LngLatLike, earthRadius} from '../lng_lat.ts';
import {angleToRotateBetweenVectors2D, clamp, degreesToRadians, radiansToDegrees, scaleZoom, createVec3f64, distanceOfAnglesRadians, warnOnce} from '../../util/util.ts';
import {angularCoordinatesToSurfaceVector, getGlobeRadiusPixels, getZoomAdjustment} from './globe_utils.ts';
import {getBearing, getConstrainedCamera} from '../../camera/camera_view_state.ts';
import {renderedProjectedCamera} from '../../camera/projected_camera.ts';
import {unprojectScreenPoint} from '../../camera/vertical_perspective_camera_math.ts';

import type Point from '@mapbox/point-geometry';
import type {ProjectedCamera, VerticalPerspectiveProjectedCamera} from '../../camera/projected_camera.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CameraOptionsFromTo, TransformConstrainFunction} from '../../camera/camera_types.ts';

/** Two points on the unit globe closer than this, a micrometre, are the same point. */
const SAME_POINT_DISTANCE = 1e-12;
/** A camera whose horizontal offset is this small relative to its distance is straight above the center. */
const STRAIGHT_ABOVE_RATIO = 1e-9;

/**
 * @internal
 * The vertical perspective part of a {@link Transform}: where it places a vertical perspective camera.
 */
export class VerticalPerspectiveTransform implements IProjectionTransform {
    /** The transform's camera as it is now, see {@link Transform.projectedCamera}. */
    private readonly _getProjectedCamera: () => ProjectedCamera;

    readonly cameraProjection: CameraProjectionKind = 'vertical-perspective';
    readonly projectionTransition: number = 1;

    /**
     * @param getProjectedCamera - Returns the transform's camera as it is now.
     */
    public constructor(getProjectedCamera: () => ProjectedCamera) {
        this._getProjectedCamera = getProjectedCamera;
    }

    /**
     * The transform's camera as the vertical perspective projects it: a globe's part reads it only while the globe
     * renders, see {@link renderedProjectedCamera}.
     */
    private get _camera(): VerticalPerspectiveProjectedCamera {
        return renderedProjectedCamera(this._getProjectedCamera()) as VerticalPerspectiveProjectedCamera;
    }

    clone(getProjectedCamera: () => ProjectedCamera): VerticalPerspectiveTransform {
        return new VerticalPerspectiveTransform(getProjectedCamera);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    getGroundElevationAtCenter(terrain?: Terrain): number | null {
        if (terrain) {
            warnOnce('terrain is not fully supported on vertical perspective projection.');
            return null;
        }
        return 0;
    }

    /**
     * Inverts the camera placement of `createVerticalPerspectiveProjectedCamera` in unit-globe coordinates: the camera
     * sits at radius `1 + altitudeFrom / earthRadius` and looks at the center on the sea-level sphere, the target altitude
     * only becoming the center elevation (the inverse of `getCameraAltitude` of `VerticalPerspectiveCameraMath`). Pitch
     * and bearing are read in the center's local frame, +z up, +y north, +x east. A camera straight above the center
     * keeps the transform's bearing.
     */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
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
        const projectedCamera = this._getProjectedCamera();
        const bearing = straightAbove ? getBearing(projectedCamera) : radiansToDegrees(Math.atan2(-toCamera[0], -toCamera[1]));

        // The camera sits cameraToCenterDistance / getGlobeRadiusPixels(worldSize, lat) from the center, and the radius doubles per zoom level.
        const zoom = scaleZoom(projectedCamera.cameraToCenterDistance / distance / getGlobeRadiusPixels(projectedCamera.tileSize, center.lat));

        return {center, elevation: altitudeTo, zoom, pitch, bearing};
    }

    /**
     * The center and zoom that {@link Transform.setLocationAtPoint} moves the camera to, or null where the camera
     * stays where it is. The zoom keeps the planet at the size it has now, from the latitude the constrain lets the
     * center reach.
     */
    getCameraForLocationAtPoint(lnglat: LngLat, point: Point, _elevation: number | undefined, constrain: TransformConstrainFunction): {center: LngLat; zoom: number} | null {
        // The elevation is ignored: this transform solves on the planet's surface.
        // This returns some fake coordinates for pixels that do not lie on the planet.
        // Whatever uses `setLocationAtPoint` will need to account for that.
        const projectedCamera = this._camera;
        const pointLngLat = unprojectScreenPoint(projectedCamera, point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3f64();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3f64();
        vec3.rotateY(rotatedPixelVector, vecToPixelCurrent, zero, -projectedCamera.center.lng * Math.PI / 180.0);
        vec3.rotateX(rotatedPixelVector, rotatedPixelVector, zero, projectedCamera.center.lat * Math.PI / 180.0);

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
            const centerLngRadians = projectedCamera.center.lng * Math.PI / 180.0;
            const centerLatRadians = projectedCamera.center.lat * Math.PI / 180.0;
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
        const moved = newLng !== projectedCamera.center.lng || newLat !== projectedCamera.center.lat;
        const {center, zoom} = moved ?
            getConstrainedCamera(projectedCamera, constrain, new LngLat(newLng, newLat), projectedCamera.zoom) :
            {center: projectedCamera.center, zoom: projectedCamera.zoom};
        const adjustedZoom = constrain(center, zoom + getZoomAdjustment(projectedCamera.center.lat, center.lat)).zoom;
        if (adjustedZoom !== zoom) return getConstrainedCamera(projectedCamera, constrain, center, adjustedZoom);
        return moved ? {center, zoom} : null;
    }
}

/**
 * Creates a transform for the vertical perspective projection.
 */
export function createVerticalPerspectiveTransform(options?: TransformOptions): Transform {
    return new Transform((getProjectedCamera) => new VerticalPerspectiveTransform(getProjectedCamera), options);
}
