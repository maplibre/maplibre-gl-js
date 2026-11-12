import Point from '@mapbox/point-geometry';
import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {angularCoordinatesToSurfaceVector, computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels, interpolateLngLatForGlobe} from './globe_utils.ts';
import {clamp, createVec3f64, differenceOfAnglesDegrees, lerp, remapSaturate, rollPitchBearingEqual, scaleZoom, warnOnce, zoomScale} from '../../util/util.ts';
import {type mat4, vec3} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {getCenterPoint, isPaddingEqual} from '../camera_state.ts';
import {applyConstrain} from './camera_constrain.ts';
import * as cameraMath from './camera_math.ts';
import {setLocationAtPoint, versorSetLocationAtPoint} from './camera_solvers.ts';
import * as cameraUpdates from './camera_updates.ts';
import * as mercatorCameraUpdates from './mercator_camera_updates.ts';

import type {CameraForBoundsOptions} from '../../ui/camera.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {PaddingOptions} from '../edge_insets.ts';
import type {CameraState} from '../camera_state.ts';
import type {ProjectedCamera} from '../projected_camera.ts';
import type {CameraContext} from './camera_constrain.ts';
import type {CameraForBoxAndBearingResult, EaseToMotion, EaseToMotionOptions, FlyToMotion, FlyToMotionOptions, MapControlsDeltas} from './camera_updates.ts';

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

export function panInertia(projectedCamera: ProjectedCamera, pan: Point): {
    easingCenter: LngLat;
    easingOffset: Point;
} {
    const panCenter = computeGlobePanCenter(pan, projectedCamera);
    if (Math.abs(panCenter.lng - projectedCamera.center.lng) > 180) {
        // If easeTo target would be over 180° distant, the animation would move
        // in the opposite direction that what the user intended.
        // Thus we clamp the movement to 179.5°.
        panCenter.lng = projectedCamera.center.lng + 179.5 * Math.sign(panCenter.lng - projectedCamera.center.lng);
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
export function rollPitchBearingZoom(state: CameraState, context: CameraContext, deltas: MapControlsDeltas): CameraState {
    const zoomPixel = deltas.around;
    const start = cameraMath.projectCamera(state, context.projection);
    const zoomLoc = cameraMath.screenPointToLocation(start, context.projection, zoomPixel);

    if (deltas.bearingDelta) state = cameraUpdates.setBearing(state, start.bearing + deltas.bearingDelta);
    if (deltas.pitchDelta) state = cameraUpdates.setPitch(state, start.pitch + deltas.pitchDelta);
    if (deltas.rollDelta) state = cameraUpdates.setRoll(state, start.roll + deltas.rollDelta);
    const oldZoomPreZoomDelta = state.zoom;
    if (deltas.zoomDelta) state = cameraUpdates.setZoom(state, context, state.zoom + deltas.zoomDelta);
    const actualZoomDelta = state.zoom - oldZoomPreZoomDelta;

    if (actualZoomDelta === 0) {
        return state;
    }

    const dLngRaw = differenceOfAnglesDegrees(state.center.lng, zoomLoc.lng);
    const dLng = dLngRaw / (Math.abs(dLngRaw / 180) + 1.0); // This gradually reduces the amount of longitude change if the zoom location is very far, eg. on the other side of the pole (possible when looking at a pole).
    const dLat = differenceOfAnglesDegrees(state.center.lat, zoomLoc.lat);

    // Slow zoom movement down if the mouse ray is far from the planet.
    const zoomed = cameraMath.projectCamera(state, context.projection);
    const rayDirection = cameraMath.getRayDirectionFromPixel(zoomed, zoomPixel);
    const rayOrigin = zoomed.cameraPosition;
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
    const radius = getGlobeRadiusPixels(zoomed.worldSize, state.center.lat) / Math.min(state.width, state.height); // Radius relative to smaller viewport dimension
    const radiusFactor = remapSaturate(radius, SLOWING_RADIUS_START, SLOWING_RADIUS_STOP, 1.0, SLOWING_RADIUS_SLOW_FACTOR);
    // Globe size only stands in for how close the zoom location is to the horizon, so apply the slowdown where that is actually the case.
    const slowingFactor = Math.min(distanceFactor, lerp(1.0, radiusFactor, interpolationFactorHorizon));

    // Compute how much to move towards the zoom location
    const factor = (1.0 - zoomScale(-actualZoomDelta)) * slowingFactor;

    const oldCenterLat = state.center.lat;
    const oldZoom = state.zoom;
    const heuristicCenter = new LngLat(
        state.center.lng + dLng * factor,
        clamp(state.center.lat + dLat * factor, -90, 90)
    );

    // Now compute the map center exact zoom
    const exact = setLocationAtPoint(state, context, zoomLoc, zoomPixel);
    const exactCenter = exact.center;

    // Interpolate between exact zooming and heuristic zooming depending on the longitude difference between current center and zoom location.
    const interpolationFactorLongitude = remapSaturate(Math.abs(dLngRaw), INTERPOLATE_TO_HEURISTIC_START_LNG, INTERPOLATE_TO_HEURISTIC_END_LNG, 0, 1);
    const heuristicFactor = Math.pow(Math.max(interpolationFactorLongitude, interpolationFactorHorizon), INTERPOLATE_TO_HEURISTIC_EXPONENT);

    const lngExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lng, heuristicCenter.lng);
    const latExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lat, heuristicCenter.lat);

    const blended = cameraUpdates.setCenter(exact, context, new LngLat(
        exactCenter.lng + lngExactToHeuristic * heuristicFactor,
        clamp(exactCenter.lat + latExactToHeuristic * heuristicFactor, -90, 90)
    ).wrap());
    return cameraUpdates.setZoom(blended, context, oldZoom + getZoomAdjustment(oldCenterLat, blended.center.lat));
}

/**
 * Pans the globe by rotating it with a single quaternion that brings the grabbed location back
 * under the cursor. This stays consistent near and across the poles, where a
 * bearing-preserving mapping inverts and stalls (#5296).
 * @param state - The camera to pan.
 * @param context - The projection and the constrain the camera is moved with.
 * @param deltas - The deltas accumulated for this frame.
 * @param preZoomAroundLoc - The location that was under the cursor before this frame.
 */
export function pan(state: CameraState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraState {
    if (!deltas.panDelta) {
        return state;
    }

    const projectedCamera = cameraMath.projectCamera(state, context.projection);
    const anchor = cameraMath.isPointOnMapSurface(projectedCamera, context.projection, deltas.around) ? deltas.around : getCenterPoint(state);
    return versorSetLocationAtPoint(state, context, preZoomAroundLoc, anchor, deltas.panDelta);
}

/** Takes the center and bearing mercator fits the bounds with, and finds the zoom that fits them on the globe. */
export function cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, state: CameraState, context: CameraContext): CameraForBoxAndBearingResult {
    const result = mercatorCameraUpdates.cameraForBoxAndBearing(options, fitPadding, mapPadding, bounds, bearing, state, context);
    if (!result) {
        return undefined;
    }

    // Get clip space bounds including fitPadding
    const {width, height} = state;
    const xLeft = (fitPadding.left) / width * 2.0 - 1.0;
    const xRight = (width - fitPadding.right) / width * 2.0 - 1.0;
    const yTop = (fitPadding.top) / height * -2.0 + 1.0;
    const yBottom = (height - fitPadding.bottom) / height * -2.0 + 1.0;

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
    let fitted = cameraUpdates.setCenter(state, context, result.center);
    fitted = cameraUpdates.setPadding(fitted, context, mapPadding);
    fitted = cameraUpdates.setBearing(fitted, result.bearing);
    fitted = cameraUpdates.setPitch(fitted, 0);
    fitted = cameraUpdates.setRoll(fitted, 0);
    fitted = cameraUpdates.setZoom(fitted, context, result.zoom);
    const matrix = cameraMath.projectCamera(fitted, context.projection).modelViewProjectionMatrix;

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
            smallestNeededScale = getLesserNonNegativeNonNull(smallestNeededScale, solveVectorScale(vec, vecToCenter, matrix, 'x', xLeft));
        if (xRight > 0)
            smallestNeededScale = getLesserNonNegativeNonNull(smallestNeededScale, solveVectorScale(vec, vecToCenter, matrix, 'x', xRight));
        if (yTop > 0)
            smallestNeededScale = getLesserNonNegativeNonNull(smallestNeededScale, solveVectorScale(vec, vecToCenter, matrix, 'y', yTop));
        if (yBottom < 0)
            smallestNeededScale = getLesserNonNegativeNonNull(smallestNeededScale, solveVectorScale(vec, vecToCenter, matrix, 'y', yBottom));
    }

    if (!Number.isFinite(smallestNeededScale) || smallestNeededScale === 0) {
        cameraUpdates.cameraBoundsWarning();
        return undefined;
    }

    // Compute target zoom from the obtained scale.
    result.zoom = Math.min(fitted.zoom + scaleZoom(smallestNeededScale), options.maxZoom);
    return result;
}

/**
 * Handles the zoom and center change during camera jumpTo.
 * The zoom decides how close to a pole the center can be, so the center is set again once the zoom has changed.
 */
export function jumpToCenterZoom(state: CameraState, context: CameraContext, options: { zoom?: number; center?: LngLatLike }): CameraState {
    const startingLat = state.center.lat;
    const center = options.center ? LngLat.convert(options.center) : state.center;
    state = cameraUpdates.setCenter(state, context, applyConstrain(state, context, center, state.zoom).center.wrap());

    // Make sure to compute correct target zoom level if no zoom is specified
    const targetZoom = options.zoom !== undefined ? +options.zoom : state.zoom + getZoomAdjustment(startingLat, state.center.lat);
    if (state.zoom === targetZoom) return state;
    state = cameraUpdates.setZoom(state, context, targetZoom);
    return cameraUpdates.setCenter(state, context, applyConstrain(state, context, center, state.zoom).center.wrap());
}

/**
 * The zoom decides how close to a pole the center can be, so the last frame sets the center again after the zoom.
 */
export function easeTo(state: CameraState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion {
    const start = cameraMath.getCameraMetrics(state, context.projection.worldCoordinateHelper);
    const startZoom = state.zoom;
    const startCenter = state.center;
    const startPadding = state.padding;
    const startEulerAngles = {roll: start.roll, pitch: start.pitch, bearing: start.bearing};
    const endEulerAngles = {
        roll: options.roll ?? start.roll,
        pitch: options.pitch ?? start.pitch,
        bearing: options.bearing ?? start.bearing,
    };
    const rotating = !rollPitchBearingEqual(startEulerAngles, endEulerAngles);
    const optionsZoom = options.zoom !== undefined;
    const doPadding = !isPaddingEqual(state.padding, options.padding);

    // Globe needs special handling for how zoom should be animated.
    // 1) if zoom is set, ease to the given mercator zoom
    // 2) if neither is set, assume constant apparent zoom (constant planet size) is to be kept
    const preConstrainCenter = options.center ?
        LngLat.convert(options.center) :
        startCenter;
    const constrainedCenter = applyConstrain(
        state,
        context,
        preConstrainCenter,
        optionsZoom ? +options.zoom : startZoom
    ).center;
    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, constrainedCenter);

    let end = cameraUpdates.setCenter(state, context, constrainedCenter);
    end = cameraUpdates.setZoom(end, context, optionsZoom ?
        +options.zoom :
        startZoom + getZoomAdjustment(startCenter.lat, preConstrainCenter.lat));
    end = cameraUpdates.setBearing(end, options.bearing);
    const clampedPoint = new Point(
        clamp(start.centerPoint.x + options.offsetAsPoint.x, 0, state.width),
        clamp(start.centerPoint.y + options.offsetAsPoint.y, 0, state.height)
    );
    end = setLocationAtPoint(end, context, constrainedCenter, clampedPoint);
    // Find final animation targets
    const endCenterWithShift = (options.offset && options.offsetAsPoint.mag()) > 0 ? end.center : constrainedCenter;
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
    const isZooming = endZoomWithShift !== startZoom;

    const easeFunc = (frame: CameraState, frameContext: CameraContext, k: number): CameraState => {
        if (rotating) frame = cameraUpdates.interpolateRotation(frame, startEulerAngles, endEulerAngles, k, startEulerAngles.roll !== endEulerAngles.roll);
        if (doPadding) frame = cameraUpdates.interpolatePadding(frame, frameContext, startPadding, options.padding, k);

        if (options.around) {
            warnOnce('Easing around a point is not supported under globe projection.');
            frame = setLocationAtPoint(frame, frameContext, options.around, options.aroundPoint);
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
            frame = cameraUpdates.setCenter(frame, frameContext, newCenter.wrap());
        }

        if (isZooming) {
            const normalizedInterpolatedZoom = interpolates.number(normalizedStartZoom, normalizedEndZoom, k);
            frame = cameraUpdates.setZoom(frame, frameContext, normalizedInterpolatedZoom + getZoomAdjustment(0, frame.center.lat));
        }

        if (k === 1 && !options.around) {
            frame = cameraUpdates.setCenter(frame, frameContext, endCenterWithShift.wrap());
        }
        return frame;
    };

    return {
        easeFunc,
        isZooming,
        elevationCenter: endCenterWithShift,
    };
}

/**
 * The zoom decides how close to a pole the center can be, so the last frame sets the center again after the zoom.
 */
export function flyTo(state: CameraState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion {
    const start = cameraMath.getCameraMetrics(state, context.projection.worldCoordinateHelper);
    const optionsZoom = options.zoom !== undefined;

    const startCenter = state.center;
    const startZoom = state.zoom;
    const startPadding = state.padding;

    const doPadding = !isPaddingEqual(state.padding, options.padding);

    // Obtain target center and zoom
    const constrainedCenter = applyConstrain(
        state,
        context,
        LngLat.convert(options.center || options.locationAtOffset),
        optionsZoom ? +options.zoom : startZoom
    ).center;
    const targetZoom = optionsZoom ? +options.zoom : startZoom + getZoomAdjustment(startCenter.lat, constrainedCenter.lat);

    // Compute the target center that respects the offset by placing the center at the offset point on the target camera.
    let end = cameraUpdates.setCenter(state, context, constrainedCenter);
    end = cameraUpdates.setZoom(end, context, targetZoom);
    end = cameraUpdates.setBearing(end, options.bearing);
    const clampedPoint = new Point(
        clamp(start.centerPoint.x + options.offsetAsPoint.x, 0, state.width),
        clamp(start.centerPoint.y + options.offsetAsPoint.y, 0, state.height)
    );
    const targetCenter = setLocationAtPoint(end, context, constrainedCenter, clampedPoint).center;

    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, targetCenter);

    const pixelPathLength = globeDistanceOfLocationsPixels(start, startCenter, targetCenter);

    const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
    const normalizedTargetZoom = targetZoom + getZoomAdjustment(targetCenter.lat, 0);
    const scaleOfZoom = zoomScale(normalizedTargetZoom - normalizedStartZoom);

    const requestedMinZoom = typeof options.minZoom === 'number' ? +options.minZoom : state.minZoom;
    const effectiveMinZoom = Math.max(requestedMinZoom, state.minZoom);
    const normalizedEffectiveMinZoom = effectiveMinZoom + getZoomAdjustment(targetCenter.lat, 0);
    const normalizedMinZoomPreConstrain = Math.min(normalizedEffectiveMinZoom, normalizedStartZoom, normalizedTargetZoom);
    const minZoomPreConstrain = normalizedMinZoomPreConstrain + getZoomAdjustment(0, targetCenter.lat);
    const minZoom = applyConstrain(state, context, targetCenter, minZoomPreConstrain).zoom;
    const normalizedMinZoom = minZoom + getZoomAdjustment(targetCenter.lat, 0);
    const scaleOfMinZoom = zoomScale(normalizedMinZoom - normalizedStartZoom);

    const deltaLng = differenceOfAnglesDegrees(startCenter.lng, targetCenter.lng);
    const deltaLat = differenceOfAnglesDegrees(startCenter.lat, targetCenter.lat);

    const easeFunc = (frame: CameraState, frameContext: CameraContext, k: number, scale: number, centerFactor: number, _pointAtOffset: Point): CameraState => {
        const interpolatedCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, centerFactor);

        if (doPadding) frame = cameraUpdates.interpolatePadding(frame, frameContext, startPadding, options.padding, k);

        const newCenter = k === 1 ? targetCenter : interpolatedCenter;
        frame = cameraUpdates.setCenter(frame, frameContext, newCenter.wrap());

        const interpolatedZoom = normalizedStartZoom + scaleZoom(scale);
        frame = cameraUpdates.setZoom(frame, frameContext, k === 1 ? targetZoom : (interpolatedZoom + getZoomAdjustment(0, newCenter.lat)));
        if (k === 1) frame = cameraUpdates.setCenter(frame, frameContext, targetCenter.wrap());
        return frame;
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
 * @param toCenter - Position of current camera center on the surface of the unit sphere globe.
 * This is needed because zooming the globe not only changes its scale,
 * but also moves the camera closer or further away along this vector (pitch is disregarded).
 * @param projection - The globe projection matrix.
 * @param targetDimension - The dimension in which the scaled vector must match the target value in clip space.
 * @param targetValue - The target clip space value in the specified dimension to which the queried vector must project.
 * @returns How much to scale the globe.
 */
function solveVectorScale(vector: vec3, toCenter: vec3, projection: mat4, targetDimension: 'x' | 'y', targetValue: number): number | null {
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
function getLesserNonNegativeNonNull(oldValue: number, newValue: number): number {
    if (newValue !== null && newValue >= 0 && newValue < oldValue) {
        return newValue;
    } else {
        return oldValue;
    }
}
