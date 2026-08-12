import Point from '@mapbox/point-geometry';
import {cameraBoundsWarning, type CameraForBoxAndBearingHandlerResult, type EaseToHandlerResult, type EaseToHandlerOptions, type FlyToHandlerResult, type FlyToHandlerOptions, type ICameraHelper, type MapControlsDeltas, updateRotation, cameraForBoxAndBearing} from './camera_helper.ts';
import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {angularCoordinatesToSurfaceVector, computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels, interpolateLngLatForGlobe, versorSetLocationAtPoint} from './globe_utils.ts';
import {clamp, createVec3f64, differenceOfAnglesDegrees, lerp, MAX_VALID_LATITUDE, remapSaturate, rollPitchBearingEqual, scaleZoom, warnOnce, zoomScale} from '../../util/util.ts';
import {type mat4, vec3} from 'gl-matrix';
import {normalizeCenter} from '../transform_helper.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';

import type {IReadonlyTransform, ITransform} from '../transform_interface.ts';
import type {CameraForBoundsOptions} from '../../ui/camera.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {PaddingOptions} from '../edge_insets.ts';

/**
 * Zoom movement slowing starts when the mouse ray passes further than this above the planet surface,
 * so a cursor off the globe does not move the map unnaturally. Globe radius is 1, so 0.3 is ~2000 km.
 */
const RAY_SURFACE_DISTANCE_FOR_SLOWING_START = 0.3;

/** How sharply zoom movement slows as the mouse ray rises above the planet surface. Lower is more gradual. */
const SLOWING_MULTIPLIER = 0.5;

/** Longitude difference between zoom location and map center at which the blend from exact to heuristic zooming starts, in degrees. */
const INTERPOLATE_TO_HEURISTIC_START_LNG = 45;

/** Longitude difference at which the blend to heuristic zooming is complete, in degrees. */
const INTERPOLATE_TO_HEURISTIC_END_LNG = 85;

/** Exponent applied to the blend factor: below 1, so the blend leans towards heuristic zooming and flattens as it completes. */
const INTERPOLATE_TO_HEURISTIC_EXPONENT = 0.25;

/**
 * Distance of the mouse ray from the globe center at which the blend from exact to heuristic zooming
 * starts. Globe radius is 1, so 1 is a ray grazing the horizon.
 */
const INTERPOLATE_TO_HEURISTIC_START_HORIZON = 0.95;

/** Ray distance at which the blend to heuristic zooming is complete. */
const INTERPOLATE_TO_HEURISTIC_END_HORIZON = 0.999;

/**
 * Globe radius relative to the smaller viewport dimension below which zoom movement near the horizon
 * starts being inhibited, avoiding unnatural movements when the map is zoomed out a lot.
 */
const SLOWING_RADIUS_START = 0.9;

/** Globe radius relative to the smaller viewport dimension at which that inhibition is at full strength. */
const SLOWING_RADIUS_STOP = 0.5;

/** Fraction of the zoom movement that remains once the globe has shrunk to `SLOWING_RADIUS_STOP`. */
const SLOWING_RADIUS_SLOW_FACTOR = 0.25;

/**
 * @internal
 */
export class VerticalPerspectiveCameraHelper implements ICameraHelper {

    get useGlobeControls(): boolean { return true; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        const panCenter = computeGlobePanCenter(pan, transform);
        if (Math.abs(panCenter.lng - transform.center.lng) > 180) {
            // If easeTo target would be over 180° distant, the animation would move
            // in the opposite direction that what the user intended.
            // Thus we clamp the movement to 179.5°.
            panCenter.lng = transform.center.lng + 179.5 * Math.sign(panCenter.lng - transform.center.lng);
        }
        return {
            easingCenter: panCenter,
            easingOffset: new Point(0, 0),
        };
    }

    /**
     * Zooms around the pointer.
     *
     * `setLocationAtPoint` is exact but degenerates when called repeatedly for a
     * location whose longitude is far from the center's, or one near the horizon,
     * so those cases blend towards a heuristic.
     */
    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        const zoomPixel = deltas.around;
        const zoomLoc = tr.screenPointToLocation(zoomPixel);

        if (deltas.bearingDelta) tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.rollDelta) tr.setRoll(tr.roll + deltas.rollDelta);
        const oldZoomPreZoomDelta = tr.zoom;
        if (deltas.zoomDelta) tr.setZoom(tr.zoom + deltas.zoomDelta);
        const actualZoomDelta = tr.zoom - oldZoomPreZoomDelta;

        if (actualZoomDelta === 0) {
            return;
        }

        const dLngRaw = differenceOfAnglesDegrees(tr.center.lng, zoomLoc.lng);
        const dLng = dLngRaw / (Math.abs(dLngRaw / 180) + 1.0); // This gradually reduces the amount of longitude change if the zoom location is very far, eg. on the other side of the pole (possible when looking at a pole).
        const dLat = differenceOfAnglesDegrees(tr.center.lat, zoomLoc.lat);

        // Slow zoom movement down if the mouse ray is far from the planet.
        const rayDirection = tr.getRayDirectionFromPixel(zoomPixel);
        const rayOrigin = tr.cameraPosition;
        const distanceToClosestPoint = vec3.dot(rayOrigin, rayDirection) * -1; // Globe center relative to ray origin is equal to -rayOrigin and rayDirection is normalized, thus we want to compute dot(-rayOrigin, rayDirection).
        const closestPoint = createVec3f64();
        vec3.add(closestPoint, rayOrigin, [
            rayDirection[0] * distanceToClosestPoint,
            rayDirection[1] * distanceToClosestPoint,
            rayDirection[2] * distanceToClosestPoint
        ]);
        const rayDistanceFromGlobeCenter = vec3.length(closestPoint); // 0 for a ray straight under the camera, 1 for one grazing the horizon.
        const distanceFromSurface = rayDistanceFromGlobeCenter - 1;
        const distanceFactor = Math.exp(-Math.max(distanceFromSurface - RAY_SURFACE_DISTANCE_FOR_SLOWING_START, 0) * SLOWING_MULTIPLIER);

        // Near the horizon a pixel is worth degrees of arc and `setLocationAtPoint` can have no solution at all.
        const interpolationFactorHorizon = remapSaturate(rayDistanceFromGlobeCenter, INTERPOLATE_TO_HEURISTIC_START_HORIZON, INTERPOLATE_TO_HEURISTIC_END_HORIZON, 0, 1);

        // Slow zoom movement down if the globe is too small on viewport
        const radius = getGlobeRadiusPixels(tr.worldSize, tr.center.lat) / Math.min(tr.width, tr.height); // Radius relative to smaller viewport dimension
        const radiusFactor = remapSaturate(radius, SLOWING_RADIUS_START, SLOWING_RADIUS_STOP, 1.0, SLOWING_RADIUS_SLOW_FACTOR);
        // Globe size only stands in for how close the zoom location is to the horizon, so apply the slowdown where that is actually the case.
        const slowingFactor = Math.min(distanceFactor, lerp(1.0, radiusFactor, interpolationFactorHorizon));

        // Compute how much to move towards the zoom location
        const factor = (1.0 - zoomScale(-actualZoomDelta)) * slowingFactor;

        const oldCenterLat = tr.center.lat;
        const oldZoom = tr.zoom;
        const heuristicCenter = new LngLat(
            tr.center.lng + dLng * factor,
            clamp(tr.center.lat + dLat * factor, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
        );

        // Now compute the map center exact zoom
        tr.setLocationAtPoint(zoomLoc, zoomPixel);
        const exactCenter = tr.center;

        // Interpolate between exact zooming and heuristic zooming depending on the longitude difference between current center and zoom location.
        const interpolationFactorLongitude = remapSaturate(Math.abs(dLngRaw), INTERPOLATE_TO_HEURISTIC_START_LNG, INTERPOLATE_TO_HEURISTIC_END_LNG, 0, 1);
        const heuristicFactor = Math.pow(Math.max(interpolationFactorLongitude, interpolationFactorHorizon), INTERPOLATE_TO_HEURISTIC_EXPONENT);

        const lngExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lng, heuristicCenter.lng);
        const latExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lat, heuristicCenter.lat);

        tr.setCenter(new LngLat(
            exactCenter.lng + lngExactToHeuristic * heuristicFactor,
            exactCenter.lat + latExactToHeuristic * heuristicFactor
        ).wrap());
        tr.setZoom(oldZoom + getZoomAdjustment(oldCenterLat, tr.center.lat));
    }

    /**
     * Pans the globe by rotating it with a single quaternion that brings the grabbed location back
     * under the cursor. This stays consistent near and across the poles, where the previous
     * bearing-preserving mapping inverted and stalled (#5296).
     * @param deltas - The deltas accumulated for this frame.
     * @param tr - The transform to pan.
     * @param preZoomAroundLoc - The location that was under the cursor before this frame.
     */
    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        if (!deltas.panDelta) {
            return;
        }

        versorSetLocationAtPoint(tr, preZoomAroundLoc, deltas.around, deltas.panDelta);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform): CameraForBoxAndBearingHandlerResult {
        const result = cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
        // If globe is enabled, we use the parameters computed for mercator, and just update the zoom to fit the bounds.

        // Get clip space bounds including padding
        const xLeft = (padding.left) / tr.width * 2.0 - 1.0;
        const xRight = (tr.width - padding.right) / tr.width * 2.0 - 1.0;
        const yTop = (padding.top) / tr.height * -2.0 + 1.0;
        const yBottom = (tr.height - padding.bottom) / tr.height * -2.0 + 1.0;

        // Get camera bounds
        const flipEastWest = differenceOfAnglesDegrees(bounds.getWest(), bounds.getEast()) < 0;
        const lngWest = flipEastWest ? bounds.getEast() : bounds.getWest();
        const lngEast = flipEastWest ? bounds.getWest() : bounds.getEast();

        const latNorth = Math.max(bounds.getNorth(), bounds.getSouth()); // "getNorth" doesn't always return north...
        const latSouth = Math.min(bounds.getNorth(), bounds.getSouth());

        // Additional vectors will be tested for the rectangle midpoints
        const lngMid = lngWest + differenceOfAnglesDegrees(lngWest, lngEast) * 0.5;
        const latMid = latNorth + differenceOfAnglesDegrees(latNorth, latSouth) * 0.5;

        // Obtain a globe projection matrix that does not include pitch (unsupported)
        const clonedTr = tr.clone();
        clonedTr.setCenter(result.center);
        clonedTr.setBearing(result.bearing);
        clonedTr.setPitch(0);
        clonedTr.setRoll(0);
        clonedTr.setZoom(result.zoom);
        const matrix = clonedTr.modelViewProjectionMatrix;

        // Vectors to test - the bounds' corners and edge midpoints
        const testVectors = [
            angularCoordinatesToSurfaceVector(bounds.getNorthWest()),
            angularCoordinatesToSurfaceVector(bounds.getNorthEast()),
            angularCoordinatesToSurfaceVector(bounds.getSouthWest()),
            angularCoordinatesToSurfaceVector(bounds.getSouthEast()),
            // Also test edge midpoints
            angularCoordinatesToSurfaceVector(new LngLat(lngEast, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngWest, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latNorth)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latSouth))
        ];
        const vecToCenter = angularCoordinatesToSurfaceVector(result.center);

        // Test each vector, measure how much to scale down the globe to satisfy all tested points that they are inside clip space.
        let smallestNeededScale = Number.POSITIVE_INFINITY;
        for (const vec of testVectors) {
            if (xLeft < 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xLeft));
            if (xRight > 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xRight));
            if (yTop > 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yTop));
            if (yBottom < 0)
                smallestNeededScale = VerticalPerspectiveCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, VerticalPerspectiveCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yBottom));
        }

        if (!Number.isFinite(smallestNeededScale) || smallestNeededScale === 0) {
            cameraBoundsWarning();
            return undefined;
        }

        // Compute target zoom from the obtained scale.
        result.zoom = Math.min(clonedTr.zoom + scaleZoom(smallestNeededScale), options.maxZoom);
        return result;
    }

    /**
     * Handles the zoom and center change during camera jumpTo.
     */
    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void {
        // Special zoom & center handling for globe:
        // Globe constrained center isn't dependent on zoom level
        const startingLat = tr.center.lat;
        const constrainedCenter = tr.applyConstrain(options.center ? LngLat.convert(options.center) : tr.center, tr.zoom).center;
        tr.setCenter(constrainedCenter.wrap());

        // Make sure to compute correct target zoom level if no zoom is specified
        const targetZoom = (typeof options.zoom !== 'undefined') ? +options.zoom : (tr.zoom + getZoomAdjustment(startingLat, constrainedCenter.lat));
        if (tr.zoom !== targetZoom) {
            tr.setZoom(targetZoom);
        }
    }

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult {
        const startZoom = tr.zoom;
        const startCenter = tr.center;
        const startPadding = tr.padding;
        const startEulerAngles = {roll: tr.roll, pitch: tr.pitch, bearing: tr.bearing};
        const endRoll = options.roll === undefined ? tr.roll : options.roll;
        const endPitch = options.pitch === undefined ? tr.pitch : options.pitch;
        const endBearing = options.bearing === undefined ? tr.bearing : options.bearing;
        const endEulerAngles = {roll: endRoll, pitch: endPitch, bearing: endBearing};

        const optionsZoom = typeof options.zoom !== 'undefined';

        const doPadding = !tr.isPaddingEqual(options.padding);

        let isZooming = false;

        // Globe needs special handling for how zoom should be animated.
        // 1) if zoom is set, ease to the given mercator zoom
        // 2) if neither is set, assume constant apparent zoom (constant planet size) is to be kept
        const preConstrainCenter = options.center ?
            LngLat.convert(options.center) :
            startCenter;
        const constrainedCenter = tr.applyConstrain(
            preConstrainCenter,
            startZoom // zoom can be whatever at this stage, it should not affect anything if globe is enabled
        ).center;
        normalizeCenter(tr, constrainedCenter);

        const clonedTr = tr.clone();
        clonedTr.setCenter(constrainedCenter);

        clonedTr.setZoom(optionsZoom ?
            +options.zoom :
            startZoom + getZoomAdjustment(startCenter.lat, preConstrainCenter.lat));
        clonedTr.setBearing(options.bearing);
        const clampedPoint = new Point(
            clamp(tr.centerPoint.x + options.offsetAsPoint.x, 0, tr.width),
            clamp(tr.centerPoint.y + options.offsetAsPoint.y, 0, tr.height)
        );
        clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
        // Find final animation targets
        const endCenterWithShift = (options.offset && options.offsetAsPoint.mag()) > 0 ? clonedTr.center : constrainedCenter;
        const endZoomWithShift = optionsZoom ?
            +options.zoom :
            startZoom + getZoomAdjustment(startCenter.lat, endCenterWithShift.lat);

        // Planet radius for a given zoom level differs according to latitude
        // Convert zooms to what they would be at equator for the given planet radius
        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedEndZoom = endZoomWithShift + getZoomAdjustment(endCenterWithShift.lat, 0);
        const deltaLng = differenceOfAnglesDegrees(startCenter.lng, endCenterWithShift.lng);
        const deltaLat = differenceOfAnglesDegrees(startCenter.lat, endCenterWithShift.lat);

        const finalScale = zoomScale(normalizedEndZoom - normalizedStartZoom);
        isZooming = (endZoomWithShift !== startZoom);

        const easeFunc = (k: number) => {
            if (!rollPitchBearingEqual(startEulerAngles, endEulerAngles)) {
                updateRotation({
                    startEulerAngles,
                    endEulerAngles,
                    tr,
                    k,
                    useSlerp: startEulerAngles.roll != endEulerAngles.roll});
            }

            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding,k);
            }

            if (options.around) {
                warnOnce('Easing around a point is not supported under globe projection.');
                tr.setLocationAtPoint(options.around, options.aroundPoint);
            } else {
                const base = normalizedEndZoom > normalizedStartZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const factor = k * speedup;

                // Spherical lerp might be used here instead, but that was tested and it leads to very weird paths when the interpolated arc gets near the poles.
                // Instead we interpolate LngLat almost directly, but taking into account that
                // one degree of longitude gets progressively smaller relative to latitude towards the poles.
                const newCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, factor);
                tr.setCenter(newCenter.wrap());
            }

            if (isZooming) {
                const normalizedInterpolatedZoom = interpolates.number(normalizedStartZoom, normalizedEndZoom, k);
                const interpolatedZoom = normalizedInterpolatedZoom + getZoomAdjustment(0, tr.center.lat);
                tr.setZoom(interpolatedZoom);
            }
        };

        return {
            easeFunc,
            isZooming,
            elevationCenter: endCenterWithShift,
        };
    }

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult {
        const optionsZoom = typeof options.zoom !== 'undefined';

        const startCenter = tr.center;
        const startZoom = tr.zoom;
        const startPadding = tr.padding;

        const doPadding = !tr.isPaddingEqual(options.padding);

        // Obtain target center and zoom
        const constrainedCenter = tr.applyConstrain(
            LngLat.convert(options.center || options.locationAtOffset),
            startZoom
        ).center;
        const targetZoom = optionsZoom ? +options.zoom : tr.zoom + getZoomAdjustment(tr.center.lat, constrainedCenter.lat);

        // Compute target center that respects offset by creating a temporary transform and calling its `setLocationAtPoint`.
        const clonedTr = tr.clone();
        clonedTr.setCenter(constrainedCenter);

        clonedTr.setZoom(targetZoom);
        clonedTr.setBearing(options.bearing);
        const clampedPoint = new Point(
            clamp(tr.centerPoint.x + options.offsetAsPoint.x, 0, tr.width),
            clamp(tr.centerPoint.y + options.offsetAsPoint.y, 0, tr.height)
        );
        clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
        const targetCenter = clonedTr.center;

        normalizeCenter(tr, targetCenter);

        const pixelPathLength = globeDistanceOfLocationsPixels(tr, startCenter, targetCenter);

        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedTargetZoom = targetZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scaleOfZoom = zoomScale(normalizedTargetZoom - normalizedStartZoom);

        const requestedMinZoom = typeof options.minZoom === 'number' ? +options.minZoom : tr.minZoom;
        const effectiveMinZoom = Math.max(requestedMinZoom, tr.minZoom);
        const normalizedEffectiveMinZoom = effectiveMinZoom + getZoomAdjustment(targetCenter.lat, 0);
        const normalizedMinZoomPreConstrain = Math.min(normalizedEffectiveMinZoom, normalizedStartZoom, normalizedTargetZoom);
        const minZoomPreConstrain = normalizedMinZoomPreConstrain + getZoomAdjustment(0, targetCenter.lat);
        const minZoom = tr.applyConstrain(targetCenter, minZoomPreConstrain).zoom;
        const normalizedMinZoom = minZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scaleOfMinZoom = zoomScale(normalizedMinZoom - normalizedStartZoom);

        const deltaLng = differenceOfAnglesDegrees(startCenter.lng, targetCenter.lng);
        const deltaLat = differenceOfAnglesDegrees(startCenter.lat, targetCenter.lat);

        const easeFunc = (k: number, scale: number, centerFactor: number, _pointAtOffset: Point) => {
            const interpolatedCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, centerFactor);

            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding,k);
            }

            const newCenter = k === 1 ? targetCenter : interpolatedCenter;
            tr.setCenter(newCenter.wrap());

            const interpolatedZoom = normalizedStartZoom + scaleZoom(scale);
            tr.setZoom(k === 1 ? targetZoom : (interpolatedZoom + getZoomAdjustment(0, newCenter.lat)));
        };

        return {
            easeFunc,
            scaleOfZoom,
            targetCenter,
            scaleOfMinZoom,
            pixelPathLength,
        };
    }

    /**
     * Computes how much to scale the globe in order for a given point on its surface (a location) to project to a given clip space coordinate in either the X or the Y axis.
     * @param vector - Position of the queried location on the surface of the unit sphere globe.
     * @param toCenter - Position of current transform center on the surface of the unit sphere globe.
     * This is needed because zooming the globe not only changes its scale,
     * but also moves the camera closer or further away along this vector (pitch is disregarded).
     * @param projection - The globe projection matrix.
     * @param targetDimension - The dimension in which the scaled vector must match the target value in clip space.
     * @param targetValue - The target clip space value in the specified dimension to which the queried vector must project.
     * @returns How much to scale the globe.
     */
    private static solveVectorScale(vector: vec3, toCenter: vec3, projection: mat4, targetDimension: 'x' | 'y', targetValue: number): number | null {
        // We want to compute how much to scale the sphere in order for the input `vector` to project to `targetValue` in the given `targetDimension` (X or Y).
        const k = targetValue;
        const columnXorY = targetDimension === 'x' ?
            [projection[0], projection[4], projection[8], projection[12]] : // X
            [projection[1], projection[5], projection[9], projection[13]];  // Y
        const columnZ = [projection[3], projection[7], projection[11], projection[15]];

        const vecDotXY = vector[0] * columnXorY[0] + vector[1] * columnXorY[1] + vector[2] * columnXorY[2];
        const vecDotZ = vector[0] * columnZ[0] + vector[1] * columnZ[1] + vector[2] * columnZ[2];
        const toCenterDotXY = toCenter[0] * columnXorY[0] + toCenter[1] * columnXorY[1] + toCenter[2] * columnXorY[2];
        const toCenterDotZ = toCenter[0] * columnZ[0] + toCenter[1] * columnZ[1] + toCenter[2] * columnZ[2];

        // The following can be derived from writing down what happens to a vector scaled by a parameter ("V * t") when it is multiplied by a projection matrix, then solving for "t".
        // Or rather, we derive it for a vector "V * t + (1-t) * C". Where V is `vector` and C is `toCenter`. The extra addition is needed because zooming out also moves the camera along "C".

        const t = (toCenterDotXY + columnXorY[3] - k * toCenterDotZ - k * columnZ[3]) / (toCenterDotXY - vecDotXY - k * toCenterDotZ + k * vecDotZ);

        if (
            toCenterDotXY + k * vecDotZ === vecDotXY + k * toCenterDotZ ||
            columnZ[3] * (vecDotXY - toCenterDotXY) + columnXorY[3] * (toCenterDotZ - vecDotZ) + vecDotXY * toCenterDotZ === toCenterDotXY * vecDotZ
        ) {
            // The computed result is invalid.
            return null;
        }
        return t;
    }

    /**
     * Returns `newValue` if it is:
     *
     * - not null AND
     * - not negative AND
     * - smaller than `newValue`,
     *
     * ...otherwise returns `oldValue`.
     */
    private static getLesserNonNegativeNonNull(oldValue: number, newValue: number): number {
        if (newValue !== null && newValue >= 0 && newValue < oldValue) {
            return newValue;
        } else {
            return oldValue;
        }
    }
}
