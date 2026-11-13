import Point from '@mapbox/point-geometry';
import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, rollPitchBearingEqual, scaleZoom, zoomScale} from '../util/util.ts';
import {getMercatorHorizon, lngLatBoxToWorldSamples, projectToWorldCoordinates, unprojectFromWorldCoordinates} from '../geo/projection/mercator_utils.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {getCenterPoint, isPaddingEqual} from './camera_view_state.ts';
import {applyConstrain} from './camera_constrain.ts';
import {projectCamera, getCameraMetrics} from './project_camera.ts';
import {getCameraMath} from './camera_math_factory.ts';
import {getCameraSolver} from './camera_solver_factory.ts';
import {interpolatePadding, interpolateRotation, normalizeCenter, setBearing, setCenter, setPadding, setPitch, setRoll, setZoom, warnBoundsCannotFit} from './camera_updates.ts';

import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {ProjectedCamera} from './projected_camera.ts';
import type {CameraContext} from './camera_context.ts';
import type {CameraForBoxAndBearingResult, CameraMotions, EaseToMotion, EaseToMotionOptions, FlyToMotion, FlyToMotionOptions, MapControlsDeltas} from './camera_motions.ts';
import type {CameraForBoundsOptions} from './camera_types.ts';

/**
 * The camera at the animation's end zoom, angles and padding, for reading where the map center ends up once a
 * location is placed at its screen point.
 */
function cameraAtAnimationEnd(view: CameraViewState, context: CameraContext, zoom: number, angles: {roll: number; pitch: number; bearing: number}, padding: PaddingOptions): CameraViewState {
    view = setZoom(view, context, zoom);
    view = setRoll(view, angles.roll);
    view = setPitch(view, angles.pitch);
    view = setBearing(view, angles.bearing);
    return setPadding(view, context, padding);
}

/** @internal The {@link CameraMotions} of a camera drawn with mercator, which moves over the flat world. */
export class MercatorCameraMotions implements CameraMotions {
    panInertia(projectedCamera: ProjectedCamera, pan: Point): {
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

    rollPitchBearingZoom(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas): CameraViewState {
        const {bearing, pitch, roll} = getCameraMetrics(view, context.worldCoordinateHelper);
        if (deltas.bearingDelta) view = setBearing(view, bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) view = setPitch(view, pitch + deltas.pitchDelta);
        if (deltas.rollDelta) view = setRoll(view, roll + deltas.rollDelta);
        if (deltas.zoomDelta) view = setZoom(view, context, view.zoom + deltas.zoomDelta);
        return view;
    }

    /**
     * Rotating about the center point leaves the center where it is: moving it there would only let it drift, the
     * more so the closer the pitch is to 90 degrees.
     */
    pan(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraViewState {
        if (deltas.around.distSqr(getCenterPoint(view)) < 1.0e-2) return view;
        return getCameraSolver(context).setLocationAtPoint(view, context, preZoomAroundLoc, deltas.around, deltas.aroundElevation);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, view: CameraViewState, context: CameraContext): CameraForBoxAndBearingResult {
        const worldCoordinateHelper = context.worldCoordinateHelper;
        const metrics = getCameraMetrics(view, worldCoordinateHelper);
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
            warnBoundsCannotFit();
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

    jumpToCenterZoom(view: CameraViewState, context: CameraContext, options: { zoom?: number; center?: LngLatLike }): CameraViewState {
        if (options.zoom !== undefined && view.zoom !== +options.zoom) {
            view = setZoom(view, context, +options.zoom);
        }
        if (options.center !== undefined) {
            view = setCenter(view, context, LngLat.convert(options.center));
        }
        return view;
    }

    easeTo(view: CameraViewState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion {
        const start = getCameraMetrics(view, context.worldCoordinateHelper);
        const startZoom = view.zoom;
        const startPadding = view.padding;
        const startEulerAngles = {roll: start.roll, pitch: start.pitch, bearing: start.bearing};
        const endEulerAngles = {
            roll: options.roll ?? start.roll,
            pitch: options.pitch ?? start.pitch,
            bearing: options.bearing ?? start.bearing,
        };
        const rotating = !rollPitchBearingEqual(startEulerAngles, endEulerAngles);
        const doPadding = !isPaddingEqual(view.padding, options.padding);
        const zoom = options.zoom !== undefined ? +options.zoom : startZoom;

        const projectedCamera = projectCamera(view, context);
        const locationAtOffset = getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, start.centerPoint.add(options.offsetAsPoint));
        const {center, zoom: endZoom} = applyConstrain(view, context, LngLat.convert(options.center || locationAtOffset), zoom);
        normalizeCenter(view, context.worldCoordinateHelper, center);

        const worldCoordinateHelper = context.worldCoordinateHelper;
        const from = projectToWorldCoordinates(start.worldSize, locationAtOffset, worldCoordinateHelper);
        const delta = projectToWorldCoordinates(start.worldSize, center, worldCoordinateHelper).sub(from);

        const finalScale = zoomScale(endZoom - startZoom);
        const isZooming = endZoom !== startZoom;

        const easeFunc = (frame: CameraViewState, frameContext: CameraContext, k: number): CameraViewState => {
            if (isZooming) frame = setZoom(frame, frameContext, interpolates.number(startZoom, endZoom, k));
            if (rotating) frame = interpolateRotation(frame, startEulerAngles, endEulerAngles, k, startEulerAngles.roll !== endEulerAngles.roll);
            if (doPadding) frame = interpolatePadding(frame, frameContext, startPadding, options.padding, k);
            if (options.around) return getCameraSolver(frameContext).setLocationAtPoint(frame, frameContext, options.around, options.aroundPoint);

            const scale = zoomScale(frame.zoom - startZoom);
            const base = endZoom > startZoom ? Math.min(2, finalScale) : Math.max(0.5, finalScale);
            const speedup = Math.pow(base, 1 - k);
            const worldSize = getCameraMetrics(frame, worldCoordinateHelper).worldSize;
            let newCenter = unprojectFromWorldCoordinates(worldSize, from.add(delta.mult(k * speedup)).mult(scale), worldCoordinateHelper);
            if (frame.renderWorldCopies && worldCoordinateHelper.wraps) newCenter = newCenter.wrap();
            const pointAtOffset = getCenterPoint(frame).add(options.offsetAsPoint);
            return setLocationAtPointKeepingZoom(frame, frameContext, newCenter, pointAtOffset);
        };

        const end = cameraAtAnimationEnd(view, context, endZoom, endEulerAngles, options.padding);
        const endCamera = options.around ?
            getCameraSolver(context).setLocationAtPoint(end, context, options.around, options.aroundPoint) :
            getCameraSolver(context).setLocationAtPoint(end, context, center, getCenterPoint(end).add(options.offsetAsPoint));

        return {
            easeFunc,
            isZooming,
            elevationCenter: endCamera.center,
        };
    }

    flyTo(view: CameraViewState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion {
        const start = getCameraMetrics(view, context.worldCoordinateHelper);
        const startZoom = view.zoom;

        const constrained = applyConstrain(
            view,
            context,
            LngLat.convert(options.center || options.locationAtOffset),
            options.zoom !== undefined ? +options.zoom : startZoom
        );
        const constrainedCenter = constrained.center;
        const targetZoom = constrained.zoom;

        normalizeCenter(view, context.worldCoordinateHelper, constrainedCenter);

        const worldCoordinateHelper = context.worldCoordinateHelper;
        const startWorldSize = start.worldSize;
        const from = projectToWorldCoordinates(startWorldSize, options.locationAtOffset, worldCoordinateHelper);
        const delta = projectToWorldCoordinates(startWorldSize, constrainedCenter, worldCoordinateHelper).sub(from);

        const pixelPathLength = delta.mag();

        const scaleOfZoom = zoomScale(targetZoom - startZoom);

        const requestedMinZoom = options.minZoom !== undefined ? +options.minZoom : view.minZoom;
        const effectiveMinZoom = Math.max(requestedMinZoom, view.minZoom);
        const minZoomPreConstrain = Math.min(effectiveMinZoom, startZoom, targetZoom);
        const minZoom = applyConstrain(view, context, constrainedCenter, minZoomPreConstrain).zoom;
        const scaleOfMinZoom = zoomScale(minZoom - startZoom);

        const easeFunc = (frame: CameraViewState, frameContext: CameraContext, k: number, scale: number, centerFactor: number, pointAtOffset: Point): CameraViewState => {
            frame = setZoom(frame, frameContext, k === 1 ? targetZoom : startZoom + scaleZoom(scale));
            let newCenter = k === 1 ?
                constrainedCenter :
                unprojectFromWorldCoordinates(startWorldSize, from.add(delta.mult(centerFactor)), worldCoordinateHelper);
            if (frame.renderWorldCopies && worldCoordinateHelper.wraps) newCenter = newCenter.wrap();
            return setLocationAtPointKeepingZoom(frame, frameContext, newCenter, pointAtOffset);
        };

        const end = cameraAtAnimationEnd(view, context, targetZoom, {roll: options.roll, pitch: options.pitch, bearing: options.bearing}, options.padding);
        const endCamera = getCameraSolver(context).setLocationAtPoint(end, context, constrainedCenter, getCenterPoint(end).add(options.offsetAsPoint));

        return {
            easeFunc,
            scaleOfZoom,
            targetCenter: endCamera.center,
            scaleOfMinZoom,
            pixelPathLength,
        };
    }
}

/**
 * Like the solver's `setLocationAtPoint`, but keeps the frame's zoom, which the globe's solver changes with when passing between projections.
 */
function setLocationAtPointKeepingZoom(frame: CameraViewState, context: CameraContext, lngLat: LngLat, point: Point): CameraViewState {
    const placed = getCameraSolver(context).setLocationAtPoint(frame, context, lngLat, point);
    return placed.zoom === frame.zoom ? placed : setZoom(placed, context, frame.zoom);
}
