import {MercatorCameraHelper} from './mercator_camera_helper';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper';

import type Point from '@mapbox/point-geometry';
import type {CameraForBoxAndBearingHandlerResult, EaseToHandlerResult, EaseToHandlerOptions, FlyToHandlerResult, FlyToHandlerOptions, ICameraHelper, MapControlsDeltas} from './camera_helper';
import type {LngLat, LngLatLike} from '../lng_lat';
import type {IReadonlyTransform, ITransform} from '../transform_interface';
import type {GlobeProjection} from './globe_projection';
import type {CameraForBoundsOptions} from '../../ui/camera';
import type {LngLatBounds} from '../lng_lat_bounds';
import type {PaddingOptions} from '../edge_insets';

/**
 * @internal
 */
export class GlobeCameraHelper implements ICameraHelper {
    private _globe: GlobeProjection;
    private _mercatorCameraHelper: MercatorCameraHelper;
    private _verticalPerspectiveCameraHelper: VerticalPerspectiveCameraHelper;

    constructor(globe: GlobeProjection) {
        this._globe = globe;
        this._mercatorCameraHelper = new MercatorCameraHelper();
        this._verticalPerspectiveCameraHelper = new VerticalPerspectiveCameraHelper();
    }

    get useGlobeControls(): boolean { return this._globe.useGlobeRendering; }

    get currentHelper(): ICameraHelper {
        return this.useGlobeControls ? this._verticalPerspectiveCameraHelper : this._mercatorCameraHelper;
    }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        return this.currentHelper.handlePanInertia(pan, transform);
    }

    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        return this.currentHelper.handleMapControlsRollPitchBearingZoom(deltas, tr);
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        //if (!this.useGlobeControls) {
        this._mercatorCameraHelper.handleMapControlsPan(deltas, tr, preZoomAroundLoc);
        //    return;
        //}

        //if (!deltas.panDelta) {
        //    return;
        //}

        // These are actually very similar to mercator controls, and should converge to them at high zooms.
        // We avoid using the "grab a place and move it around" approach from mercator here,
        // since it is not a very pleasant way to pan a globe.
        const oldLat = tr.center.lat;
        const oldZoom = tr.zoom;
        tr.setCenter(computeGlobePanCenter(deltas.panDelta, tr).wrap());
        // Setting the center might adjust zoom to keep globe size constant, we need to avoid adding this adjustment a second time
        //ZERDA
        //tr.setZoom(oldZoom + getZoomAdjustment(oldLat, tr.center.lat));
        tr.setZoom(oldZoom);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform): CameraForBoxAndBearingHandlerResult {
        return this.currentHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }

    /**
     * Handles the zoom and center change during camera jumpTo.
     */
    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void {
        this.currentHelper.handleJumpToCenterZoom(tr, options);
    }

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult {
        if (!this.useGlobeControls) {
            return this._mercatorCameraHelper.handleEaseTo(tr, options);
        }

        const startZoom = tr.zoom;
        const startCenter = tr.center;
        const startRotation = rollPitchBearingToQuat(tr.roll, tr.pitch, tr.bearing);
        const endRoll = options.roll === undefined ? tr.roll : options.roll;
        const endPitch = options.pitch === undefined ? tr.pitch : options.pitch;
        const endBearing = options.bearing === undefined ? tr.bearing : options.bearing;
        const endRotation = rollPitchBearingToQuat(endRoll, endPitch, endBearing);

        const optionsZoom = typeof options.zoom !== 'undefined';

        const doPadding = !tr.isPaddingEqual(options.padding);

        let isZooming = false;

        // Globe needs special handling for how zoom should be animated.
        // 1) if zoom is set, ease to the given mercator zoom
        // 2) if neither is set, assume constant apparent zoom (constant planet size) is to be kept
        const preConstrainCenter = options.center ?
            LngLat.convert(options.center) :
            startCenter;
        const constrainedCenter = tr.getConstrained(
            preConstrainCenter,
            startZoom // zoom can be whatever at this stage, it should not affect anything if globe is enabled
        ).center;
        normalizeCenter(tr, constrainedCenter);

        const clonedTr = tr.clone();
        clonedTr.setCenter(constrainedCenter);
        if (doPadding) {
            clonedTr.setPadding(options.padding);
        }
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
            if (!quat.equals(startRotation, endRotation)) {
                updateRotation(startRotation, endRotation, {roll: endRoll, pitch: endPitch, bearing: endBearing}, tr, k);
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
                //ZERDA
                if (optionsZoom) tr.setZoom(interpolatedZoom);
                else tr.setZoom(startZoom);
            }
        };

        return {
            easeFunc,
            isZooming,
            elevationCenter: endCenterWithShift,
        };
    }

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult {
        return this.currentHelper.handleFlyTo(tr, options);
    }
}