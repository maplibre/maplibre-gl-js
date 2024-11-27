import type Point from '@mapbox/point-geometry';
import {type IReadonlyTransform, type ITransform} from '../transform_interface';
import {type LngLat, type LngLatLike} from '../lng_lat';
import {type CameraForBoundsOptions, type PointLike} from '../../ui/camera';
import {type PaddingOptions} from '../edge_insets';
import {type LngLatBounds} from '../lng_lat_bounds';
import {getRollPitchBearing, type RollPitchBearing, rollPitchBearingToQuat, warnOnce} from '../../util/util';
import {quat} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';

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

export type UpdateRotationArgs = {
    /**
     * The starting Euler angles.
     */
    startEulerAngles: RollPitchBearing;

    /**
     * The end Euler angles.
     */
    endEulerAngles: RollPitchBearing;

    /**
     * The transform to be updated
     */
    tr: ITransform;

    /**
     * The interpolation fraction, between 0 and 1.
     */
    k: number;

    /**
     * If true, use spherical linear interpolation. If false, use linear interpolation of Euler angles.
     */
    useSlerp: boolean;
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
 * Set a transform's rotation to a value interpolated between startEulerAngles and endEulerAngles
 */
export function updateRotation(args: UpdateRotationArgs) {
    if (args.useSlerp) {
        // At pitch ==0, the Euler angle representation is ambiguous. In this case, set the Euler angles
        // to the representation requested by the caller
        if (args.k < 1) {
            const startRotation = rollPitchBearingToQuat(args.startEulerAngles.roll, args.startEulerAngles.pitch, args.startEulerAngles.bearing);
            const endRotation = rollPitchBearingToQuat(args.endEulerAngles.roll, args.endEulerAngles.pitch, args.endEulerAngles.bearing);
            const rotation: quat = new Float64Array(4) as any;
            quat.slerp(rotation, startRotation, endRotation, args.k);
            const eulerAngles = getRollPitchBearing(rotation);
            args.tr.setRoll(eulerAngles.roll);
            args.tr.setPitch(eulerAngles.pitch);
            args.tr.setBearing(eulerAngles.bearing);
        } else {
            args.tr.setRoll(args.endEulerAngles.roll);
            args.tr.setPitch(args.endEulerAngles.pitch);
            args.tr.setBearing(args.endEulerAngles.bearing);
        }
    } else {
        args.tr.setRoll(interpolates.number(args.startEulerAngles.roll, args.endEulerAngles.roll, args.k));
        args.tr.setPitch(interpolates.number(args.startEulerAngles.pitch, args.endEulerAngles.pitch, args.k));
        args.tr.setBearing(interpolates.number(args.startEulerAngles.bearing, args.endEulerAngles.bearing, args.k));
    }
}
