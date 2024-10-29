import Point from '@mapbox/point-geometry';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {LngLat, LngLatLike} from '../lng_lat';
import {CameraForBoundsOptions, PointLike} from '../../ui/camera';
import {PaddingOptions} from '../edge_insets';
import {LngLatBounds} from '../lng_lat_bounds';
import {getRollPitchBearing, RollPitchBearing, warnOnce} from '../../util/util';
import {quat} from 'gl-matrix';

export type MapControlsDeltas = {
    panDelta: Point;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
    rollDelta: number;
    around: Point;
}

export type CameraForBoxAndBearingHandlerResult = {
    center: LngLat;
    zoom: number;
    bearing: number;
};

export type EaseToHandlerOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    around?: LngLat;
    aroundPoint?: Point;
    center?: LngLatLike;
    zoom?: number;
    offset?: PointLike;
}

export type EaseToHandlerResult = {
    easeFunc: (k: number) => void;
    elevationCenter: LngLat;
    isZooming: boolean;
}

export type FlyToHandlerOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    center?: LngLatLike;
    locationAtOffset: LngLat;
    zoom?: number;
    minZoom?: number;
}

export type FlyToHandlerResult = {
    easeFunc: (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => void;
    scaleOfZoom: number;
    scaleOfMinZoom?: number;
    targetCenter: LngLat;
    pixelPathLength: number;
}

/**
 * @internal
 */
export function cameraBoundsWarning() {
    warnOnce(
        'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
    );
}

/**
 * @internal
 * Contains projection-specific functions related to camera controls, easeTo, flyTo, inertia, etc.
 */
export interface ICameraHelper {
    get useGlobeControls(): boolean;

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };

    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void;

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): CameraForBoxAndBearingHandlerResult;

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void;

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult;

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult;
}

/**
 * @internal
 * Set a transform's rotation to a value interpolated between startRotation and endRotation
 * @param startRotation - the starting rotation (rotation when k = 0)
 * @param endRotation - the end rotation (rotation when k = 1)
 * @param endEulerAngles - the end Euler angles. This is needed in case `endRotation` has an ambiguous Euler angle representation.
 * @param tr - the transform to be updated
 * @param k - the interpolation fraction, between 0 and 1.
 */
export function updateRotation(startRotation: quat, endRotation: quat, endEulerAngles: RollPitchBearing, tr: ITransform, k: number) {
    // At pitch ==0, the Euler angle representation is ambiguous. In this case, set the Euler angles
    // to the representation requested by the caller
    if (k < 1) {
        const rotation: quat = new Float64Array(4) as any;
        quat.slerp(rotation, startRotation, endRotation, k);
        const eulerAngles = getRollPitchBearing(rotation);
        tr.setRoll(eulerAngles.roll);
        tr.setPitch(eulerAngles.pitch);
        tr.setBearing(eulerAngles.bearing);
    } else {
        tr.setRoll(endEulerAngles.roll);
        tr.setPitch(endEulerAngles.pitch);
        tr.setBearing(endEulerAngles.bearing);
    }
}
