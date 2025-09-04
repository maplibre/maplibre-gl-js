import type Point from '@mapbox/point-geometry';
import {LngLat, type LngLatLike} from '../lng_lat';
import {cameraForBoxAndBearing, type CameraForBoxAndBearingHandlerResult, type EaseToHandlerResult, type EaseToHandlerOptions, type FlyToHandlerResult, type FlyToHandlerOptions, type ICameraHelper, type MapControlsDeltas, updateRotation, type UpdateRotationArgs} from './camera_helper';
import {normalizeCenter} from '../transform_helper';
import {rollPitchBearingEqual, scaleZoom, zoomScale} from '../../util/util';
import {getMercatorHorizon, projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';

import type {IReadonlyTransform, ITransform} from '../transform_interface';
import type {CameraForBoundsOptions} from '../../ui/camera';
import type {PaddingOptions} from '../edge_insets';
import type {LngLatBounds} from '../lng_lat_bounds';

/**
 * @internal
 */
export class MercatorCameraHelper implements ICameraHelper {
    get useGlobeControls(): boolean { return false; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        // Reduce the offset so that it never goes past the horizon. If it goes past
        // the horizon, the pan direction is opposite of the intended direction.
        const offsetLength = pan.mag();
        const pixelsToHorizon = Math.abs(getMercatorHorizon(transform));
        const horizonFactor = 0.75; // Must be < 1 to prevent the offset from crossing the horizon
        const offsetAsPoint = pan.mult(Math.min(pixelsToHorizon * horizonFactor / offsetLength, 1.0));
        return {
            easingOffset: offsetAsPoint,
            easingCenter: transform.center,
        };
    }

    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        if (deltas.bearingDelta) tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.rollDelta) tr.setRoll(tr.roll + deltas.rollDelta);
        if (deltas.zoomDelta) tr.setZoom(tr.zoom + deltas.zoomDelta);
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        // If we are rotating about the center point, there is no need to update the transform center. Doing so causes
        // a small amount of drift of the center point, especially when pitch is close to 90 degrees.
        // In this case, return early.
        if (deltas.around.distSqr(tr.centerPoint) < 1.0e-2) {
            return;
        }
        tr.setLocationAtPoint(preZoomAroundLoc, deltas.around);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): CameraForBoxAndBearingHandlerResult {
        return cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void {
        // Mercator zoom & center handling.
        const optionsZoom = typeof options.zoom !== 'undefined';

        const zoom = optionsZoom ? +options.zoom : tr.zoom;
        if (tr.zoom !== zoom) {
            tr.setZoom(+options.zoom);
        }

        if (options.center !== undefined) {
            tr.setCenter(LngLat.convert(options.center));
        }
    }

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult {
        const startZoom = tr.zoom;
        const startPadding = tr.padding;
        const startEulerAngles = {roll: tr.roll, pitch: tr.pitch, bearing: tr.bearing};
        const endRoll = options.roll === undefined ? tr.roll : options.roll;
        const endPitch = options.pitch === undefined ? tr.pitch : options.pitch;
        const endBearing = options.bearing === undefined ? tr.bearing : options.bearing;
        const endEulerAngles = {roll: endRoll, pitch: endPitch, bearing: endBearing};

        const optionsZoom = typeof options.zoom !== 'undefined';

        const doPadding = !tr.isPaddingEqual(options.padding);

        let isZooming = false;

        const zoom = optionsZoom ? +options.zoom : tr.zoom;

        let pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);
        const {center, zoom: endZoom} = tr.getConstrained(
            LngLat.convert(options.center || locationAtOffset),
            zoom ?? startZoom
        );
        normalizeCenter(tr, center);

        const from = projectToWorldCoordinates(tr.worldSize, locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, center).sub(from);

        const finalScale = zoomScale(endZoom - startZoom);
        isZooming = (endZoom !== startZoom);

        const easeFunc = (k: number) => {
            if (isZooming) {
                tr.setZoom(interpolates.number(startZoom, endZoom, k));
            }
            if (!rollPitchBearingEqual(startEulerAngles, endEulerAngles)) {
                updateRotation({
                    startEulerAngles,
                    endEulerAngles,
                    tr,
                    k,
                    useSlerp: startEulerAngles.roll != endEulerAngles.roll} as UpdateRotationArgs);
            }
            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding, k);
                // When padding is being applied, Transform.centerPoint is changing continuously,
                // thus we need to recalculate offsetPoint every frame
                pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
            }

            if (options.around) {
                tr.setLocationAtPoint(options.around, options.aroundPoint);
            } else {
                const scale = zoomScale(tr.zoom - startZoom);
                const base = endZoom > startZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const newCenter = unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(k * speedup)).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            }
        };

        return {
            easeFunc,
            isZooming,
            elevationCenter: center,
        };
    }

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult {
        const optionsZoom = typeof options.zoom !== 'undefined';

        const startZoom = tr.zoom;

        // Obtain target center and zoom
        const constrained = tr.getConstrained(
            LngLat.convert(options.center || options.locationAtOffset),
            optionsZoom ? +options.zoom : startZoom
        );
        const targetCenter = constrained.center;
        const targetZoom = constrained.zoom;

        normalizeCenter(tr, targetCenter);

        const from = projectToWorldCoordinates(tr.worldSize, options.locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, targetCenter).sub(from);

        const pixelPathLength = delta.mag();

        const scaleOfZoom = zoomScale(targetZoom - startZoom);

        const optionsMinZoom = typeof options.minZoom !== 'undefined';

        let scaleOfMinZoom: number;

        if (optionsMinZoom) {
            const minZoomPreConstrain = Math.min(+options.minZoom, startZoom, targetZoom);
            const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
            scaleOfMinZoom = zoomScale(minZoom - startZoom);
        }

        const easeFunc = (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => {
            tr.setZoom(k === 1 ? targetZoom : startZoom + scaleZoom(scale));
            const newCenter = k === 1 ? targetCenter : unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(centerFactor)).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
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
