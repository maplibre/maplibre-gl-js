import Point from '@mapbox/point-geometry';
import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, rollPitchBearingEqual, scaleZoom, zoomScale} from '../../util/util.ts';
import {getMercatorHorizon, lngLatBoxToWorldSamples, projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {getCenterPoint, isPaddingEqual} from '../camera_state.ts';
import {applyConstrain} from './camera_constrain.ts';
import {projectCamera, getCameraMetrics, screenPointToLocation} from './camera_math.ts';
import {setLocationAtPoint} from './camera_solvers.ts';
import * as cameraUpdates from './camera_updates.ts';

import type {CameraForBoundsOptions} from '../../ui/camera.ts';
import type {PaddingOptions} from '../edge_insets.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {CameraState} from '../camera_state.ts';
import type {ProjectedCamera} from '../projected_camera.ts';
import type {CameraContext} from './camera_constrain.ts';
import type {CameraForBoxAndBearingResult, EaseToMotion, EaseToMotionOptions, FlyToMotion, FlyToMotionOptions, MapControlsDeltas} from './camera_updates.ts';

export function panInertia(projectedCamera: ProjectedCamera, pan: Point): {
    easingCenter: LngLat;
    easingOffset: Point;
} {
    // Reduce the offset so that it never goes past the horizon. If it goes past
    // the horizon, the pan direction is opposite of the intended direction.
    const offsetLength = pan.mag();
    const pixelsToHorizon = Math.abs(getMercatorHorizon(projectedCamera));
    const horizonFactor = 0.75; // Must be < 1 to prevent the offset from crossing the horizon
    const offsetAsPoint = pan.mult(Math.min(pixelsToHorizon * horizonFactor / offsetLength, 1.0));
    return {
        easingOffset: offsetAsPoint,
        easingCenter: projectedCamera.center,
    };
}

export function rollPitchBearingZoom(state: CameraState, context: CameraContext, deltas: MapControlsDeltas): CameraState {
    const {bearing, pitch, roll} = getCameraMetrics(state, context.projection.worldCoordinateHelper);
    if (deltas.bearingDelta) state = cameraUpdates.setBearing(state, bearing + deltas.bearingDelta);
    if (deltas.pitchDelta) state = cameraUpdates.setPitch(state, pitch + deltas.pitchDelta);
    if (deltas.rollDelta) state = cameraUpdates.setRoll(state, roll + deltas.rollDelta);
    if (deltas.zoomDelta) state = cameraUpdates.setZoom(state, context, state.zoom + deltas.zoomDelta);
    return state;
}

/**
 * Rotating about the center point leaves the center where it is: moving it there would only let it drift, the
 * more so the closer the pitch is to 90 degrees.
 */
export function pan(state: CameraState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraState {
    if (deltas.around.distSqr(getCenterPoint(state)) < 1.0e-2) return state;
    return setLocationAtPoint(state, context, preZoomAroundLoc, deltas.around, deltas.aroundElevation);
}

export function cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, state: CameraState, context: CameraContext): CameraForBoxAndBearingResult {
    const worldCoordinateHelper = context.projection.worldCoordinateHelper;
    const metrics = getCameraMetrics(state, worldCoordinateHelper);
    // Fit the whole box, not only its corners: rotate the points sampled over it by the bearing and take
    // the rectangle around them in the rotated frame, grown by how far the edges bulge past the points.

    const nwWorld = projectToWorldCoordinates(metrics.worldSize, bounds.getNorthWest(), worldCoordinateHelper);
    const neWorld = projectToWorldCoordinates(metrics.worldSize, bounds.getNorthEast(), worldCoordinateHelper);
    const seWorld = projectToWorldCoordinates(metrics.worldSize, bounds.getSouthEast(), worldCoordinateHelper);
    const swWorld = projectToWorldCoordinates(metrics.worldSize, bounds.getSouthWest(), worldCoordinateHelper);
    const [south, north] = worldCoordinateHelper.wraps ?
        [clamp(bounds.getSouth(), -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE), clamp(bounds.getNorth(), -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)] :
        [bounds.getSouth(), bounds.getNorth()];
    const {points, bulge} = lngLatBoxToWorldSamples(worldCoordinateHelper, bounds.getWest(), south, bounds.getEast(), north);

    const bearingRadians = degreesToRadians(-bearing);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        const {x, y} = point.mult(metrics.worldSize).rotate(bearingRadians);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    const worldBulge = bulge * metrics.worldSize;
    const upperRight = new Point(maxX + worldBulge, maxY + worldBulge);
    const lowerLeft = new Point(minX - worldBulge, minY - worldBulge);

    // Calculate zoom: consider the original bbox and both paddings.
    const size = upperRight.sub(lowerLeft);

    const availableWidth = (metrics.width - (mapPadding.left + mapPadding.right + fitPadding.left + fitPadding.right));
    const availableHeight = (metrics.height - (mapPadding.top + mapPadding.bottom + fitPadding.top + fitPadding.bottom));
    const scaleX = availableWidth / size.x;
    const scaleY = availableHeight / size.y;

    // A box reaching a point the projection sends to infinity has no finite size to fit.
    if (scaleY < 0 || scaleX < 0 || !Number.isFinite(size.x) || !Number.isFinite(size.y)) {
        cameraUpdates.cameraBoundsWarning();
        return undefined;
    }

    const zoom = Math.min(scaleZoom(metrics.scale * Math.min(scaleX, scaleY)), options.maxZoom);

    // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of the fit padding.
    const offset = Point.convert(options.offset);
    const paddingOffsetX = (fitPadding.left - fitPadding.right) / 2;
    const paddingOffsetY = (fitPadding.top - fitPadding.bottom) / 2;
    const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
    const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
    const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
    const offsetAtFinalZoom = offsetAtInitialZoom.mult(metrics.scale / zoomScale(zoom));

    // The middle of the fitted rectangle, rotated back. For a box that projects to a parallelogram, as every box
    // does in mercator, that is the midpoint of its diagonal, taken directly to keep rotation rounding out of it.
    const projectsToParallelogram = bulge === 0 && nwWorld.add(seWorld).equals(neWorld.add(swWorld));
    const middle = projectsToParallelogram ? nwWorld.add(seWorld).div(2) : upperRight.add(lowerLeft).div(2).rotate(-bearingRadians);
    const center = unprojectFromWorldCoordinates(
        metrics.worldSize,
        middle.sub(offsetAtFinalZoom),
        worldCoordinateHelper
    );

    return {
        center,
        zoom,
        bearing
    };
}

export function jumpToCenterZoom(state: CameraState, context: CameraContext, options: { zoom?: number; center?: LngLatLike }): CameraState {
    if (options.zoom !== undefined && state.zoom !== +options.zoom) {
        state = cameraUpdates.setZoom(state, context, +options.zoom);
    }
    if (options.center !== undefined) {
        state = cameraUpdates.setCenter(state, context, LngLat.convert(options.center));
    }
    return state;
}

export function easeTo(state: CameraState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion {
    const start = getCameraMetrics(state, context.projection.worldCoordinateHelper);
    const startZoom = state.zoom;
    const startPadding = state.padding;
    const startEulerAngles = {roll: start.roll, pitch: start.pitch, bearing: start.bearing};
    const endEulerAngles = {
        roll: options.roll ?? start.roll,
        pitch: options.pitch ?? start.pitch,
        bearing: options.bearing ?? start.bearing,
    };
    const rotating = !rollPitchBearingEqual(startEulerAngles, endEulerAngles);
    const doPadding = !isPaddingEqual(state.padding, options.padding);
    const zoom = options.zoom !== undefined ? +options.zoom : startZoom;

    const locationAtOffset = screenPointToLocation(projectCamera(state, context.projection), context.projection, start.centerPoint.add(options.offsetAsPoint));
    const {center, zoom: endZoom} = applyConstrain(state, context, LngLat.convert(options.center || locationAtOffset), zoom);
    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, center);

    const worldCoordinateHelper = context.projection.worldCoordinateHelper;
    const from = projectToWorldCoordinates(start.worldSize, locationAtOffset, worldCoordinateHelper);
    const delta = projectToWorldCoordinates(start.worldSize, center, worldCoordinateHelper).sub(from);

    const finalScale = zoomScale(endZoom - startZoom);
    const isZooming = endZoom !== startZoom;

    const easeFunc = (frame: CameraState, frameContext: CameraContext, k: number): CameraState => {
        if (isZooming) frame = cameraUpdates.setZoom(frame, frameContext, interpolates.number(startZoom, endZoom, k));
        if (rotating) frame = cameraUpdates.interpolateRotation(frame, startEulerAngles, endEulerAngles, k, startEulerAngles.roll !== endEulerAngles.roll);
        if (doPadding) frame = cameraUpdates.interpolatePadding(frame, frameContext, startPadding, options.padding, k);
        if (options.around) return setLocationAtPoint(frame, frameContext, options.around, options.aroundPoint);

        const scale = zoomScale(frame.zoom - startZoom);
        const base = endZoom > startZoom ? Math.min(2, finalScale) : Math.max(0.5, finalScale);
        const speedup = Math.pow(base, 1 - k);
        const worldSize = getCameraMetrics(frame, worldCoordinateHelper).worldSize;
        const newCenter = unprojectFromWorldCoordinates(worldSize, from.add(delta.mult(k * speedup)).mult(scale), worldCoordinateHelper);
        const pointAtOffset = getCenterPoint(frame).add(options.offsetAsPoint);
        return setLocationAtPoint(frame, frameContext, frame.renderWorldCopies && worldCoordinateHelper.wraps ? newCenter.wrap() : newCenter, pointAtOffset);
    };

    const end = cameraAtAnimationEnd(state, context, endZoom, endEulerAngles, options.padding);
    const endCamera = options.around ?
        setLocationAtPoint(end, context, options.around, options.aroundPoint) :
        setLocationAtPoint(end, context, center, getCenterPoint(end).add(options.offsetAsPoint));

    return {
        easeFunc,
        isZooming,
        elevationCenter: endCamera.center,
    };
}

export function flyTo(state: CameraState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion {
    const start = getCameraMetrics(state, context.projection.worldCoordinateHelper);
    const startZoom = state.zoom;

    const constrained = applyConstrain(
        state,
        context,
        LngLat.convert(options.center || options.locationAtOffset),
        options.zoom !== undefined ? +options.zoom : startZoom
    );
    const constrainedCenter = constrained.center;
    const targetZoom = constrained.zoom;

    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, constrainedCenter);

    const worldCoordinateHelper = context.projection.worldCoordinateHelper;
    const startWorldSize = start.worldSize;
    const from = projectToWorldCoordinates(startWorldSize, options.locationAtOffset, worldCoordinateHelper);
    const delta = projectToWorldCoordinates(startWorldSize, constrainedCenter, worldCoordinateHelper).sub(from);

    const pixelPathLength = delta.mag();

    const scaleOfZoom = zoomScale(targetZoom - startZoom);

    const requestedMinZoom = options.minZoom !== undefined ? +options.minZoom : state.minZoom;
    const effectiveMinZoom = Math.max(requestedMinZoom, state.minZoom);
    const minZoomPreConstrain = Math.min(effectiveMinZoom, startZoom, targetZoom);
    const minZoom = applyConstrain(state, context, constrainedCenter, minZoomPreConstrain).zoom;
    const scaleOfMinZoom = zoomScale(minZoom - startZoom);

    const easeFunc = (frame: CameraState, frameContext: CameraContext, k: number, scale: number, centerFactor: number, pointAtOffset: Point): CameraState => {
        frame = cameraUpdates.setZoom(frame, frameContext, k === 1 ? targetZoom : startZoom + scaleZoom(scale));
        const newCenter = k === 1 ?
            constrainedCenter :
            unprojectFromWorldCoordinates(startWorldSize, from.add(delta.mult(centerFactor)), worldCoordinateHelper);
        return setLocationAtPoint(frame, frameContext, frame.renderWorldCopies && worldCoordinateHelper.wraps ? newCenter.wrap() : newCenter, pointAtOffset);
    };

    const end = cameraAtAnimationEnd(state, context, targetZoom, {roll: options.roll, pitch: options.pitch, bearing: options.bearing}, options.padding);
    const endCamera = setLocationAtPoint(end, context, constrainedCenter, getCenterPoint(end).add(options.offsetAsPoint));

    return {
        easeFunc,
        scaleOfZoom,
        targetCenter: endCamera.center,
        scaleOfMinZoom,
        pixelPathLength,
    };
}

/**
 * The camera at the animation's end zoom, angles and padding, for reading where the map center ends up once a
 * location is placed at its screen point.
 */
function cameraAtAnimationEnd(state: CameraState, context: CameraContext, zoom: number, angles: {roll: number; pitch: number; bearing: number}, padding: PaddingOptions): CameraState {
    state = cameraUpdates.setZoom(state, context, zoom);
    state = cameraUpdates.setRoll(state, angles.roll);
    state = cameraUpdates.setPitch(state, angles.pitch);
    state = cameraUpdates.setBearing(state, angles.bearing);
    return cameraUpdates.setPadding(state, context, padding);
}
