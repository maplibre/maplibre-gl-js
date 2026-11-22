import Point from '@mapbox/point-geometry';
import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment, globeDistanceOfLocationsPixels, interpolateLngLatForGlobe} from '../geo/projection/globe_utils.ts';
import {clamp, createVec3f64, degreesToRadians, differenceOfAnglesDegrees, lerp, remapSaturate, rollPitchBearingEqual, scaleZoom, warnOnce, zoomScale} from '../util/util.ts';
import {vec3} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {getCenterPoint, isPaddingEqual} from './camera_view_state.ts';
import {applyConstrain} from './camera_constrain.ts';
import {getCameraMath} from './camera_math_factory.ts';
import {projectCamera, getCameraMetrics} from './project_camera.ts';
import {getCameraSolver} from './camera_solver_factory.ts';
import {versorSetLocationAtPoint} from './vertical_perspective_camera_solver.ts';
import {interpolatePadding, interpolateRotation, normalizeCenter, setBearing, setCenter, setPadding, setPitch, setRoll, setZoom, warnBoundsCannotFit} from './camera_updates.ts';

import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {ProjectedCamera} from './projected_camera.ts';
import type {CameraContext} from './camera_context.ts';
import type {MercatorCameraMotions} from './mercator_camera_motions.ts';
import type {CameraForBoxAndBearingResult, CameraMotions, EaseToMotion, EaseToMotionOptions, FlyToMotion, FlyToMotionOptions, MapControlsDeltas} from './camera_motions.ts';
import type {CameraForBoundsOptions} from './camera_types.ts';

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

/** How many steps each edge of a box is sampled in when it is fitted on the globe, which draws the edges as curves. */
const GLOBE_FIT_EDGE_STEPS = 16;

/** The globe fit stops once another pass would move the drawn box by less than this many pixels. */
const GLOBE_FIT_TOLERANCE_PIXELS = 1e-2;

/** The most passes the globe fit makes, each of which centers the drawn box and zooms it to fill the padded area. */
const GLOBE_FIT_MAX_PASSES = 16;

/**
 * Locations along the edges of a box, from corner to corner. The globe draws parallels and meridians as curves, so
 * how far a box reaches on the screen is set by points along its edges as well as by its corners.
 */
function sampleBoxEdges(bounds: LngLatBounds): LngLat[] {
    const west = bounds.getWest();
    const east = bounds.getEast();
    const north = Math.max(bounds.getNorth(), bounds.getSouth());
    const south = Math.min(bounds.getNorth(), bounds.getSouth());
    const samples: LngLat[] = [];
    for (let step = 0; step <= GLOBE_FIT_EDGE_STEPS; step++) {
        const lng = west + (east - west) * step / GLOBE_FIT_EDGE_STEPS;
        const lat = south + (north - south) * step / GLOBE_FIT_EDGE_STEPS;
        samples.push(new LngLat(lng, north), new LngLat(lng, south), new LngLat(west, lat), new LngLat(east, lat));
    }
    return samples;
}

/** The screen rectangle a camera draws locations in. */
function getDrawnExtent(view: CameraViewState, context: CameraContext, locations: LngLat[]): {min: Point; max: Point} {
    const projectedCamera = projectCamera(view, context);
    const cameraMath = getCameraMath(projectedCamera);
    const min = new Point(Infinity, Infinity);
    const max = new Point(-Infinity, -Infinity);
    for (const location of locations) {
        const point = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, location);
        min.x = Math.min(min.x, point.x);
        min.y = Math.min(min.y, point.y);
        max.x = Math.max(max.x, point.x);
        max.y = Math.max(max.y, point.y);
    }
    return {min, max};
}

/** The location a camera draws at a screen point. */
function getDrawnLocation(view: CameraViewState, context: CameraContext, point: Point): LngLat {
    const projectedCamera = projectCamera(view, context);
    return getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, point);
}

/** The camera that draws at `to` the location a camera draws at `from`. */
function moveDrawnPoint(view: CameraViewState, context: CameraContext, from: Point, to: Point): CameraViewState {
    return getCameraSolver(context).setLocationAtPoint(view, context, getDrawnLocation(view, context, from), to);
}

/** The camera zoomed to `zoom` around a screen point, which goes on drawing the location it drew there. */
function zoomAroundPoint(view: CameraViewState, context: CameraContext, point: Point, zoom: number): CameraViewState {
    const location = getDrawnLocation(view, context, point);
    return getCameraSolver(context).setLocationAtPoint(setZoom(view, context, zoom), context, location, point);
}

/** How many times further an extent can reach from a point before it reaches `room` pixels away, or infinity if it does not reach out from it. */
function getRoomScale(room: number, extent: number): number {
    return extent > 0 ? room / extent : Infinity;
}

/** @internal The {@link CameraMotions} of a camera drawn as a globe, which turns the planet. */
export class VerticalPerspectiveCameraMotions implements CameraMotions {
    /** Fits a box the way mercator does, which the globe then corrects for its curvature. */
    private readonly _mercator: MercatorCameraMotions;

    constructor(mercator: MercatorCameraMotions) {
        this._mercator = mercator;
    }

    panInertia(projectedCamera: ProjectedCamera, pan: Point): {
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
    rollPitchBearingZoom(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas): CameraViewState {
        const zoomPixel = deltas.around;
        const start = projectCamera(view, context);
        const zoomLoc = getCameraMath(start).screenPointToLocation(start, context.worldCoordinateHelper, zoomPixel);

        if (deltas.bearingDelta) view = setBearing(view, start.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) view = setPitch(view, start.pitch + deltas.pitchDelta);
        if (deltas.rollDelta) view = setRoll(view, start.roll + deltas.rollDelta);
        const oldZoomPreZoomDelta = view.zoom;
        if (deltas.zoomDelta) view = setZoom(view, context, view.zoom + deltas.zoomDelta);
        const actualZoomDelta = view.zoom - oldZoomPreZoomDelta;

        if (actualZoomDelta === 0) {
            return view;
        }

        const dLngRaw = differenceOfAnglesDegrees(view.center.lng, zoomLoc.lng);
        const dLng = dLngRaw / (Math.abs(dLngRaw / 180) + 1.0); // This gradually reduces the amount of longitude change if the zoom location is very far, eg. on the other side of the pole (possible when looking at a pole).
        const dLat = differenceOfAnglesDegrees(view.center.lat, zoomLoc.lat);

        // Slow zoom movement down if the mouse ray is far from the planet.
        const zoomed = projectCamera(view, context);
        const rayDirection = getCameraMath(zoomed).getRayDirectionFromPixel(zoomed, zoomPixel);
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
        const radius = getGlobeRadiusPixels(zoomed.worldSize, view.center.lat) / Math.min(view.width, view.height); // Radius relative to smaller viewport dimension
        const radiusFactor = remapSaturate(radius, SLOWING_RADIUS_START, SLOWING_RADIUS_STOP, 1.0, SLOWING_RADIUS_SLOW_FACTOR);
        // Globe size only stands in for how close the zoom location is to the horizon, so apply the slowdown where that is actually the case.
        const slowingFactor = Math.min(distanceFactor, lerp(1.0, radiusFactor, interpolationFactorHorizon));

        // Compute how much to move towards the zoom location
        const factor = (1.0 - zoomScale(-actualZoomDelta)) * slowingFactor;

        const oldCenterLat = view.center.lat;
        const oldZoom = view.zoom;
        const heuristicCenter = new LngLat(
            view.center.lng + dLng * factor,
            clamp(view.center.lat + dLat * factor, -90, 90)
        );

        // Now compute the map center exact zoom
        const exact = getCameraSolver(context).setLocationAtPoint(view, context, zoomLoc, zoomPixel);
        const exactCenter = exact.center;

        // Interpolate between exact zooming and heuristic zooming depending on the longitude difference between current center and zoom location.
        const interpolationFactorLongitude = remapSaturate(Math.abs(dLngRaw), INTERPOLATE_TO_HEURISTIC_START_LNG, INTERPOLATE_TO_HEURISTIC_END_LNG, 0, 1);
        const heuristicFactor = Math.pow(Math.max(interpolationFactorLongitude, interpolationFactorHorizon), INTERPOLATE_TO_HEURISTIC_EXPONENT);

        const lngExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lng, heuristicCenter.lng);
        const latExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lat, heuristicCenter.lat);

        const blended = setCenter(exact, context, new LngLat(
            exactCenter.lng + lngExactToHeuristic * heuristicFactor,
            clamp(exactCenter.lat + latExactToHeuristic * heuristicFactor, -90, 90)
        ).wrap());
        return setZoom(blended, context, oldZoom + getZoomAdjustment(oldCenterLat, blended.center.lat));
    }

    /**
     * Pans the globe by rotating it with a single quaternion that brings the grabbed location back
     * under the cursor. This stays consistent near and across the poles, where a
     * bearing-preserving mapping inverts and stalls (#5296).
     * @param view - The camera to pan.
     * @param context - The projection and the constrain the camera is moved with.
     * @param deltas - The deltas accumulated for this frame.
     * @param preZoomAroundLoc - The location that was under the cursor before this frame.
     */
    pan(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraViewState {
        if (!deltas.panDelta) {
            return view;
        }

        const projectedCamera = projectCamera(view, context);
        const anchor = getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, deltas.around) ? deltas.around : getCenterPoint(view);
        return versorSetLocationAtPoint(view, context, preZoomAroundLoc, anchor, deltas.panDelta);
    }

    /**
     * Fits the bounds as the globe draws them, starting from the camera mercator fits them with. The globe bends the
     * edges of the box and scales it unevenly as it zooms, so each pass moves the middle of the drawn box to the middle
     * of the area inside the padding, then zooms around that point until the box fills the area. Map padding and fit
     * padding take the same path: map padding moves the point the camera looks at, and both narrow the area.
     */
    cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, view: CameraViewState, context: CameraContext): CameraForBoxAndBearingResult {
        const result = this._mercator.cameraForBoxAndBearing(options, fitPadding, mapPadding, bounds, bearing, view, context);
        if (!result) {
            return undefined;
        }

        const left = mapPadding.left + fitPadding.left;
        const right = view.width - mapPadding.right - fitPadding.right;
        const top = mapPadding.top + fitPadding.top;
        const bottom = view.height - mapPadding.bottom - fitPadding.bottom;
        const target = new Point((left + right) / 2, (top + bottom) / 2).add(Point.convert(options.offset).rotate(degreesToRadians(-bearing)));
        const samples = sampleBoxEdges(bounds);

        let fitted = setCenter(view, context, result.center);
        fitted = setPadding(fitted, context, mapPadding);
        fitted = setBearing(fitted, result.bearing);
        fitted = setPitch(fitted, 0);
        fitted = setRoll(fitted, 0);
        fitted = setZoom(fitted, context, result.zoom);

        for (let pass = 0; pass < GLOBE_FIT_MAX_PASSES; pass++) {
            const drawn = getDrawnExtent(fitted, context, samples);
            const middle = drawn.min.add(drawn.max).div(2);
            fitted = moveDrawnPoint(fitted, context, middle, target);

            const centered = getDrawnExtent(fitted, context, samples);
            const scale = Math.min(
                getRoomScale(target.x - left, target.x - centered.min.x),
                getRoomScale(right - target.x, centered.max.x - target.x),
                getRoomScale(target.y - top, target.y - centered.min.y),
                getRoomScale(bottom - target.y, centered.max.y - target.y));
            const zoom = Math.min(fitted.zoom + scaleZoom(scale), options.maxZoom);
            if (!Number.isFinite(zoom)) {
                warnBoundsCannotFit();
                return undefined;
            }

            const size = Math.max(centered.max.x - centered.min.x, centered.max.y - centered.min.y);
            const growth = Math.abs(zoomScale(zoom - fitted.zoom) - 1) * size;
            fitted = zoomAroundPoint(fitted, context, target, zoom);
            if (middle.dist(target) < GLOBE_FIT_TOLERANCE_PIXELS && growth < GLOBE_FIT_TOLERANCE_PIXELS) break;
        }

        return {center: fitted.center, zoom: fitted.zoom, bearing: result.bearing};
    }

    /**
     * Handles the zoom and center change during camera jumpTo.
     * The zoom decides how close to a pole the center can be, so the center is set again once the zoom has changed.
     */
    jumpToCenterZoom(view: CameraViewState, context: CameraContext, options: { zoom?: number; center?: LngLatLike }): CameraViewState {
        const startingLat = view.center.lat;
        const center = options.center ? LngLat.convert(options.center) : view.center;
        view = setCenter(view, context, applyConstrain(view, context, center, view.zoom).center.wrap());

        // Make sure to compute correct target zoom level if no zoom is specified
        const targetZoom = options.zoom !== undefined ? +options.zoom : view.zoom + getZoomAdjustment(startingLat, view.center.lat);
        if (view.zoom === targetZoom) return view;
        view = setZoom(view, context, targetZoom);
        return setCenter(view, context, applyConstrain(view, context, center, view.zoom).center.wrap());
    }

    /**
     * The zoom decides how close to a pole the center can be, so the last frame sets the center again after the zoom.
     */
    easeTo(view: CameraViewState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion {
        const start = getCameraMetrics(view, context.worldCoordinateHelper);
        const startZoom = view.zoom;
        const startCenter = view.center;
        const startPadding = view.padding;
        const startEulerAngles = {roll: start.roll, pitch: start.pitch, bearing: start.bearing};
        const endEulerAngles = {
            roll: options.roll ?? start.roll,
            pitch: options.pitch ?? start.pitch,
            bearing: options.bearing ?? start.bearing,
        };
        const rotating = !rollPitchBearingEqual(startEulerAngles, endEulerAngles);
        const optionsZoom = options.zoom !== undefined;
        const doPadding = !isPaddingEqual(view.padding, options.padding);

        // Globe needs special handling for how zoom should be animated.
        // 1) if zoom is set, ease to the given mercator zoom
        // 2) if neither is set, assume constant apparent zoom (constant planet size) is to be kept
        const preConstrainCenter = options.center ?
            LngLat.convert(options.center) :
            startCenter;
        const constrainedCenter = applyConstrain(
            view,
            context,
            preConstrainCenter,
            optionsZoom ? +options.zoom : startZoom
        ).center;
        normalizeCenter(view, context.worldCoordinateHelper, constrainedCenter);

        let end = setCenter(view, context, constrainedCenter);
        end = setZoom(end, context, optionsZoom ?
            +options.zoom :
            startZoom + getZoomAdjustment(startCenter.lat, preConstrainCenter.lat));
        end = setBearing(end, options.bearing);
        const clampedPoint = new Point(
            clamp(start.centerPoint.x + options.offsetAsPoint.x, 0, view.width),
            clamp(start.centerPoint.y + options.offsetAsPoint.y, 0, view.height)
        );
        end = getCameraSolver(context).setLocationAtPoint(end, context, constrainedCenter, clampedPoint);
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

        const easeFunc = (frame: CameraViewState, frameContext: CameraContext, k: number): CameraViewState => {
            if (rotating) frame = interpolateRotation(frame, startEulerAngles, endEulerAngles, k, startEulerAngles.roll !== endEulerAngles.roll);
            if (doPadding) frame = interpolatePadding(frame, frameContext, startPadding, options.padding, k);

            if (options.around) {
                warnOnce('Easing around a point is not supported under globe projection.');
                frame = getCameraSolver(frameContext).setLocationAtPoint(frame, frameContext, options.around, options.aroundPoint);
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
                frame = setCenter(frame, frameContext, newCenter.wrap());
            }

            if (isZooming) {
                const normalizedInterpolatedZoom = interpolates.number(normalizedStartZoom, normalizedEndZoom, k);
                frame = setZoom(frame, frameContext, normalizedInterpolatedZoom + getZoomAdjustment(0, frame.center.lat));
            }

            if (k === 1 && !options.around) {
                frame = setCenter(frame, frameContext, endCenterWithShift.wrap());
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
    flyTo(view: CameraViewState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion {
        const start = getCameraMetrics(view, context.worldCoordinateHelper);
        const optionsZoom = options.zoom !== undefined;

        const startCenter = view.center;
        const startZoom = view.zoom;
        const startPadding = view.padding;

        const doPadding = !isPaddingEqual(view.padding, options.padding);

        // Obtain target center and zoom
        const constrainedCenter = applyConstrain(
            view,
            context,
            LngLat.convert(options.center || options.locationAtOffset),
            optionsZoom ? +options.zoom : startZoom
        ).center;
        const targetZoom = optionsZoom ? +options.zoom : startZoom + getZoomAdjustment(startCenter.lat, constrainedCenter.lat);

        // Compute the target center that respects the offset by placing the center at the offset point on the target camera.
        let end = setCenter(view, context, constrainedCenter);
        end = setZoom(end, context, targetZoom);
        end = setBearing(end, options.bearing);
        const clampedPoint = new Point(
            clamp(start.centerPoint.x + options.offsetAsPoint.x, 0, view.width),
            clamp(start.centerPoint.y + options.offsetAsPoint.y, 0, view.height)
        );
        const targetCenter = getCameraSolver(context).setLocationAtPoint(end, context, constrainedCenter, clampedPoint).center;

        normalizeCenter(view, context.worldCoordinateHelper, targetCenter);

        const pixelPathLength = globeDistanceOfLocationsPixels(start, startCenter, targetCenter);

        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedTargetZoom = targetZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scaleOfZoom = zoomScale(normalizedTargetZoom - normalizedStartZoom);

        const requestedMinZoom = typeof options.minZoom === 'number' ? +options.minZoom : view.minZoom;
        const effectiveMinZoom = Math.max(requestedMinZoom, view.minZoom);
        const normalizedEffectiveMinZoom = effectiveMinZoom + getZoomAdjustment(targetCenter.lat, 0);
        const normalizedMinZoomPreConstrain = Math.min(normalizedEffectiveMinZoom, normalizedStartZoom, normalizedTargetZoom);
        const minZoomPreConstrain = normalizedMinZoomPreConstrain + getZoomAdjustment(0, targetCenter.lat);
        const minZoom = applyConstrain(view, context, targetCenter, minZoomPreConstrain).zoom;
        const normalizedMinZoom = minZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scaleOfMinZoom = zoomScale(normalizedMinZoom - normalizedStartZoom);

        const deltaLng = differenceOfAnglesDegrees(startCenter.lng, targetCenter.lng);
        const deltaLat = differenceOfAnglesDegrees(startCenter.lat, targetCenter.lat);

        const easeFunc = (frame: CameraViewState, frameContext: CameraContext, k: number, scale: number, centerFactor: number, _pointAtOffset: Point): CameraViewState => {
            const interpolatedCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, centerFactor);

            if (doPadding) frame = interpolatePadding(frame, frameContext, startPadding, options.padding, k);

            const newCenter = k === 1 ? targetCenter : interpolatedCenter;
            frame = setCenter(frame, frameContext, newCenter.wrap());

            const interpolatedZoom = normalizedStartZoom + scaleZoom(scale);
            frame = setZoom(frame, frameContext, k === 1 ? targetZoom : (interpolatedZoom + getZoomAdjustment(0, newCenter.lat)));
            if (k === 1) frame = setCenter(frame, frameContext, targetCenter.wrap());
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
}
